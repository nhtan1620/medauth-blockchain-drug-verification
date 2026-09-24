'use strict';

const { PackLifecycleContract, assertZeroPii } = require('../lib/packLifecycle');

/** Minimal in-memory mock of a Fabric transaction context / chaincode stub. */
function createMockCtx(mspId = 'WissenPharmaMSP') {
  const state = new Map();
  let txCounter = 0;
  return {
    clientIdentity: { getMSPID: () => mspId },
    stub: {
      getState: async (key) => Buffer.from(state.get(key) ? JSON.stringify(state.get(key)) : ''),
      putState: async (key, buf) => state.set(key, JSON.parse(buf.toString())),
      getTxID: () => `tx-${++txCounter}`,
      getTxTimestamp: () => ({ seconds: { low: Math.floor(Date.now() / 1000) } }),
      setEvent: () => {},
      createCompositeKey: (type, parts) => `${type}:${parts.join(':')}`,
      getStateByPartialCompositeKey: async (type, parts) => {
        const prefix = `${type}:${parts.join(':')}`;
        const entries = [...state.entries()].filter(([k]) => k.startsWith(prefix));
        let i = 0;
        return {
          next: async () => {
            if (i >= entries.length) return { done: true };
            const [, value] = entries[i++];
            return { done: false, value: { value: Buffer.from(JSON.stringify(value)) } };
          },
          close: async () => {},
        };
      },
    },
    _state: state,
  };
}

describe('PackLifecycleContract (chaincode)', () => {
  const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

  test('zero-PII guard rejects a payload containing a blocklisted field', () => {
    expect(() => assertZeroPii({ patient: { name: 'Jane Doe' } })).toThrow(/PII/i);
  });

  test('commission -> ship -> receive -> dispense succeeds in order', async () => {
    const ctx = createMockCtx();
    const contract = new PackLifecycleContract();

    await contract.CommissionPack(ctx, '9506000134352', 'LOT-1', 'SN-1', futureExpiry);
    await contract.ShipPack(ctx, '9506000134352', 'LOT-1', 'SN-1');
    await contract.ReceivePack(ctx, '9506000134352', 'LOT-1', 'SN-1');
    const result = await contract.DispensePack(ctx, '9506000134352', 'LOT-1', 'SN-1');

    const record = JSON.parse(result);
    expect(record.bizStep).toBe('dispense');

    const pack = JSON.parse(await contract.QueryPack(ctx, '9506000134352', 'SN-1'));
    expect(pack.lastEvent).toBe('dispense');
  });

  test('rejects dispensing before receive', async () => {
    const ctx = createMockCtx();
    const contract = new PackLifecycleContract();
    await contract.CommissionPack(ctx, '9506000134352', 'LOT-1', 'SN-2', futureExpiry);
    await expect(contract.DispensePack(ctx, '9506000134352', 'LOT-1', 'SN-2')).rejects.toThrow(/transition/i);
  });

  test('rejects dispensing an expired pack', async () => {
    const ctx = createMockCtx();
    const contract = new PackLifecycleContract();
    await contract.CommissionPack(ctx, '9506000134352', 'LOT-1', 'SN-3', '2000-01-01T00:00:00.000Z');
    await contract.ShipPack(ctx, '9506000134352', 'LOT-1', 'SN-3');
    await contract.ReceivePack(ctx, '9506000134352', 'LOT-1', 'SN-3');
    await expect(contract.DispensePack(ctx, '9506000134352', 'LOT-1', 'SN-3')).rejects.toThrow(/expired/i);
  });

  test('regulator MSP identity cannot submit write transactions (read-only observer, R1/R7)', async () => {
    const ctx = createMockCtx('RegulatorObserverMSP');
    const contract = new PackLifecycleContract();
    await expect(contract.CommissionPack(ctx, '9506000134352', 'LOT-1', 'SN-4', futureExpiry)).rejects.toThrow(/read-only/i);
  });

  test('GetEventTrail returns the full ordered lifecycle for a pack', async () => {
    const ctx = createMockCtx();
    const contract = new PackLifecycleContract();
    await contract.CommissionPack(ctx, '9506000134352', 'LOT-1', 'SN-5', futureExpiry);
    await contract.ShipPack(ctx, '9506000134352', 'LOT-1', 'SN-5');

    const trail = JSON.parse(await contract.GetEventTrail(ctx, '9506000134352', 'SN-5'));
    expect(trail.map((e) => e.bizStep)).toEqual(['commission', 'ship']);
  });
});
