'use strict';

const { Contract } = require('fabric-contract-api');

const VALID_EVENTS = ['commission', 'ship', 'receive', 'dispense', 'recall'];

const ALLOWED_TRANSITIONS = {
  commission: ['ship', 'recall'],
  ship: ['receive', 'recall'],
  receive: ['dispense', 'ship', 'recall'],
  dispense: ['recall'],
  recall: [],
};

// Zero-PII-on-chain guard (Objective 3 / R3). Any of these keys anywhere
// in a submitted payload cause the transaction to be rejected before it
// is ever written to the ledger. This is the authoritative, on-chain
// enforcement point — the API gateway's own guard (backend/src/ledger/chaincode.js)
// is defence-in-depth, not the source of truth.
const PII_FIELD_BLOCKLIST = ['name', 'dob', 'phone', 'email', 'address', 'nationalid', 'patientname', 'ssn'];

const GTIN_REGEX = /^\d{13,14}$/;

class ChaincodeValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || 'VALIDATION_ERROR';
  }
}

function assertZeroPii(payload) {
  const seen = new Set();
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
    seen.add(obj);
    for (const [key, value] of Object.entries(obj)) {
      if (PII_FIELD_BLOCKLIST.includes(key.toLowerCase())) {
        throw new ChaincodeValidationError(
          `Zero-PII-on-chain violation: field "${key}" is not permitted on the ledger`,
          'PII_ON_CHAIN'
        );
      }
      if (value && typeof value === 'object') walk(value);
    }
  };
  walk(payload);
}

function sgtinKey(gtin, serial) {
  return `${gtin}.${serial}`;
}

class PackLifecycleContract extends Contract {
  constructor() {
    super('medauth.pack.lifecycle');
  }

  /**
   * Identity check helper — in a deployed network this reads the calling
   * client's MSP-issued certificate attributes (org, role) via
   * ctx.clientIdentity, which is how CA/MSP-based onboarding (R1) is
   * enforced at the chaincode layer, not just at the API gateway.
   */
  _getCallerOrg(ctx) {
    const org = ctx.clientIdentity.getMSPID();
    if (!org) throw new ChaincodeValidationError('Unable to resolve caller organisation from MSP identity', 'NO_IDENTITY');
    return org;
  }

  _assertNotRegulator(ctx) {
    // Regulator org is onboarded as a read-only observer (R1, R7): its
    // MSP identity is never granted permission to submit write transactions.
    const org = this._getCallerOrg(ctx);
    if (org === 'RegulatorObserverMSP') {
      throw new ChaincodeValidationError('Regulator identity is read-only and cannot submit ledger writes', 'READ_ONLY_IDENTITY');
    }
    return org;
  }

  async InitLedger(ctx) {
    // No-op on purpose: the permissioned pilot starts with an empty pack
    // registry. Kept for parity with the Fabric sample chaincode lifecycle.
    return;
  }

  /**
   * Generic transition handler shared by every lifecycle transaction below.
   * Enforces: valid GS1 identifiers, valid event name, valid state
   * transition, expiry rule on dispense, and the zero-PII guard.
   */
  async _recordEvent(ctx, { gtin, lot, serial, expiry, bizStep }) {
    if (!GTIN_REGEX.test(gtin)) throw new ChaincodeValidationError('Invalid GTIN', 'INVALID_GTIN');
    if (!lot) throw new ChaincodeValidationError('Lot is required', 'MISSING_LOT');
    if (!serial) throw new ChaincodeValidationError('Serial is required', 'MISSING_SERIAL');
    if (!VALID_EVENTS.includes(bizStep)) throw new ChaincodeValidationError(`Unknown event "${bizStep}"`, 'INVALID_EVENT');

    const org = this._assertNotRegulator(ctx);
    const key = sgtinKey(gtin, serial);
    const existingBytes = await ctx.stub.getState(key);
    const existing = existingBytes && existingBytes.length ? JSON.parse(existingBytes.toString()) : null;
    const lastEvent = existing ? existing.lastEvent : null;

    const allowed = lastEvent ? ALLOWED_TRANSITIONS[lastEvent] || [] : ['commission'];
    if (!allowed.includes(bizStep) && !(lastEvent === null && bizStep === 'commission')) {
      throw new ChaincodeValidationError(`Invalid lifecycle transition: ${lastEvent || '(none)'} -> ${bizStep}`, 'INVALID_TRANSITION');
    }

    const effectiveExpiry = expiry || (existing ? existing.expiry : null);
    if (bizStep === 'dispense' && effectiveExpiry && new Date(effectiveExpiry).getTime() < Date.now()) {
      throw new ChaincodeValidationError('Cannot dispense an expired pack', 'EXPIRED_PACK');
    }

    const txTimestamp = ctx.stub.getTxTimestamp();
    const createdAt = new Date(txTimestamp.seconds.low * 1000).toISOString();

    const eventRecord = {
      sgtin: key,
      gtin,
      lot,
      serial,
      expiry: effectiveExpiry,
      bizStep,
      org,
      txId: ctx.stub.getTxID(),
      createdAt,
    };

    assertZeroPii(eventRecord);

    const state = {
      sgtin: key,
      gtin,
      lot,
      serial,
      expiry: eventRecord.expiry,
      manufacturer: existing ? existing.manufacturer : (bizStep === 'commission' ? org : null),
      lastEvent: bizStep,
      lastOrg: org,
      updatedAt: createdAt,
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(state)));

    // Append-only event trail, indexed by composite key so a range query
    // returns every event for a given SGTIN in commit order (mirrors the
    // Event-trail drawer in the mobile app).
    const eventKey = ctx.stub.createCompositeKey('event', [key, ctx.stub.getTxID()]);
    await ctx.stub.putState(eventKey, Buffer.from(JSON.stringify(eventRecord)));

    // Emit a chaincode event so an off-chain EPCIS bridge / operations
    // dashboard (R9, R10) can subscribe without polling the ledger.
    ctx.stub.setEvent('PackLifecycleEvent', Buffer.from(JSON.stringify(eventRecord)));

    return JSON.stringify(eventRecord);
  }

  async CommissionPack(ctx, gtin, lot, serial, expiry) {
    return this._recordEvent(ctx, { gtin, lot, serial, expiry, bizStep: 'commission' });
  }

  async ShipPack(ctx, gtin, lot, serial) {
    return this._recordEvent(ctx, { gtin, lot, serial, bizStep: 'ship' });
  }

  async ReceivePack(ctx, gtin, lot, serial) {
    return this._recordEvent(ctx, { gtin, lot, serial, bizStep: 'receive' });
  }

  async DispensePack(ctx, gtin, lot, serial) {
    return this._recordEvent(ctx, { gtin, lot, serial, bizStep: 'dispense' });
  }

  async RecallPack(ctx, gtin, lot, serial) {
    return this._recordEvent(ctx, { gtin, lot, serial, bizStep: 'recall' });
  }

  /** Read-only — available to every org including the regulator observer (R1). */
  async QueryPack(ctx, gtin, serial) {
    const key = sgtinKey(gtin, serial);
    const bytes = await ctx.stub.getState(key);
    if (!bytes || !bytes.length) {
      return JSON.stringify({ found: false, sgtin: key });
    }
    return bytes.toString();
  }

  /** Read-only event trail for a pack — powers the Event-trail drawer and regulator audit view. */
  async GetEventTrail(ctx, gtin, serial) {
    const sgtin = sgtinKey(gtin, serial);
    const iterator = await ctx.stub.getStateByPartialCompositeKey('event', [sgtin]);
    const results = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value && res.value.value.length) {
        results.push(JSON.parse(res.value.value.toString()));
      }
      res = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(results);
  }
}

module.exports = { PackLifecycleContract, ChaincodeValidationError, assertZeroPii, PII_FIELD_BLOCKLIST };
