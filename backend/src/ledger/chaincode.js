const gs1 = require('../utils/gs1');

const PII_FIELD_BLOCKLIST = (process.env.PII_FIELD_BLOCKLIST || 'name,dob,phone,email,address,nationalId')
  .split(',')
  .map((f) => f.trim().toLowerCase());

class ChaincodeError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || 'CHAINCODE_ERROR';
  }
}

/**
 * Zero-PII-on-chain guard (R3). Recursively rejects any payload destined
 * for the ledger that contains a blocklisted field name. This mirrors the
 * equivalent check inside chaincode/medauth-pack-lifecycle/lib/packLifecycle.js,
 * which enforces the same rule inside the Fabric chaincode itself.
 */
function assertZeroPii(payload) {
  const seen = new Set();
  function walk(obj) {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
    seen.add(obj);
    for (const [key, value] of Object.entries(obj)) {
      if (PII_FIELD_BLOCKLIST.includes(key.toLowerCase())) {
        throw new ChaincodeError(
          `Zero-PII-on-chain violation: field "${key}" is not permitted on the ledger`,
          'PII_ON_CHAIN'
        );
      }
      if (value && typeof value === 'object') walk(value);
    }
  }
  walk(payload);
}

/**
 * Validate + build the on-chain payload for a pack lifecycle event.
 * Throws ChaincodeError on any rule violation (mirrors chaincode.InvokeTransaction).
 */
function validatePackEvent({ gtin, lot, serial, expiry, bizStep, org, lastEvent }) {
  if (!gs1.isValidGtin(gtin)) throw new ChaincodeError('Invalid GTIN', 'INVALID_GTIN');
  if (!lot) throw new ChaincodeError('Lot is required', 'MISSING_LOT');
  if (!serial) throw new ChaincodeError('Serial is required', 'MISSING_SERIAL');
  if (!gs1.isValidEvent(bizStep)) throw new ChaincodeError(`Unknown event "${bizStep}"`, 'INVALID_EVENT');
  if (!gs1.isValidTransition(lastEvent, bizStep)) {
    throw new ChaincodeError(
      `Invalid lifecycle transition: ${lastEvent || '(none)'} -> ${bizStep}`,
      'INVALID_TRANSITION'
    );
  }
  if (bizStep === 'dispense' && gs1.isExpired(expiry)) {
    throw new ChaincodeError('Cannot dispense an expired pack', 'EXPIRED_PACK');
  }

  const sgtin = gs1.buildSgtin(gtin, serial);
  const onChainPayload = {
    sgtin,
    gtin,
    lot,
    serial,
    expiry,
    bizStep,
    org,
    // No PII/PHI here by construction — see assertZeroPii below, which is
    // still run as a defence-in-depth guard before this ever reaches the ledger.
  };
  assertZeroPii(onChainPayload);
  return { sgtin, onChainPayload };
}

module.exports = { validatePackEvent, assertZeroPii, ChaincodeError, PII_FIELD_BLOCKLIST };
