const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/app');
const { validatePackEvent, assertZeroPii, ChaincodeError } = require('../src/ledger/chaincode');

const TEST_DB = path.join(__dirname, 'tmp-ledger.db');

function cleanup() {
  ['', '-wal', '-shm'].forEach((suffix) => {
    const p = TEST_DB + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

describe('PermissionedLedger + chaincode rules', () => {
  let db;
  let ledger;

  beforeEach(() => {
    cleanup();
    const created = createApp({ dbPath: TEST_DB });
    db = created.db;
    ledger = created.ledger;
  });

  afterEach(() => {
    db.close();
    cleanup();
  });

  test('commits a hash-chained block and preserves integrity', () => {
    const { onChainPayload, sgtin } = validatePackEvent({
      gtin: '9506000134352',
      lot: 'LOT-1',
      serial: 'SN-1',
      expiry: new Date(Date.now() + 1e10).toISOString(),
      bizStep: 'commission',
      org: 'WissenPharma',
      lastEvent: null,
    });
    const block = ledger.commit({ org: 'WissenPharma', sgtin, bizStep: 'commission', payload: onChainPayload });
    expect(block.blockIndex).toBe(1);
    expect(block.prevHash).toBe('0'.repeat(64));

    const integrity = ledger.verifyIntegrity();
    expect(integrity.valid).toBe(true);
    expect(integrity.blocks).toBe(1);
  });

  test('detects tampering in the hash chain', () => {
    const { onChainPayload, sgtin } = validatePackEvent({
      gtin: '9506000134352',
      lot: 'LOT-1',
      serial: 'SN-1',
      expiry: new Date(Date.now() + 1e10).toISOString(),
      bizStep: 'commission',
      org: 'WissenPharma',
      lastEvent: null,
    });
    ledger.commit({ org: 'WissenPharma', sgtin, bizStep: 'commission', payload: onChainPayload });

    db.prepare('UPDATE ledger_blocks SET biz_step = ? WHERE block_index = 1').run('ship');

    const integrity = ledger.verifyIntegrity();
    expect(integrity.valid).toBe(false);
    expect(integrity.brokenAtBlock).toBe(1);
  });

  test('rejects an invalid lifecycle transition (dispense before receive)', () => {
    expect(() =>
      validatePackEvent({
        gtin: '9506000134352',
        lot: 'LOT-1',
        serial: 'SN-1',
        expiry: new Date(Date.now() + 1e10).toISOString(),
        bizStep: 'dispense',
        org: 'CityPharmacy',
        lastEvent: null,
      })
    ).toThrow(ChaincodeError);
  });

  test('rejects dispensing an expired pack', () => {
    expect(() =>
      validatePackEvent({
        gtin: '9506000134352',
        lot: 'LOT-1',
        serial: 'SN-1',
        expiry: '2000-01-01T00:00:00.000Z',
        bizStep: 'dispense',
        org: 'CityPharmacy',
        lastEvent: 'receive',
      })
    ).toThrow(/expired/i);
  });

  test('zero-PII-on-chain guard rejects a payload containing a blocklisted field', () => {
    expect(() => assertZeroPii({ sgtin: 'x', patient: { name: 'Jane Doe' } })).toThrow(/PII/i);
  });

  test('zero-PII-on-chain guard allows a clean on-chain payload', () => {
    expect(() => assertZeroPii({ sgtin: 'x', gtin: '9506000134352', lot: 'LOT-1', bizStep: 'ship' })).not.toThrow();
  });

  test('validatePackEvent never includes PII fields in the returned on-chain payload', () => {
    const { onChainPayload } = validatePackEvent({
      gtin: '9506000134352',
      lot: 'LOT-1',
      serial: 'SN-1',
      expiry: new Date(Date.now() + 1e10).toISOString(),
      bizStep: 'commission',
      org: 'WissenPharma',
      lastEvent: null,
    });
    expect(Object.keys(onChainPayload)).not.toContain('name');
    expect(Object.keys(onChainPayload)).not.toContain('phone');
  });
});
