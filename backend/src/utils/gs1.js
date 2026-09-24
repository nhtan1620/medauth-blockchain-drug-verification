/**
 * GS1-aligned helpers for the MedAuth pilot.
 * Pack-level identifiers: GTIN / SGTIN, lot, expiry, serial.
 * Event lifecycle (GS1 EPCIS CBV-style "bizStep"): commission, ship,
 * receive, dispense, recall.
 */

const VALID_EVENTS = ['commission', 'ship', 'receive', 'dispense', 'recall'];

// GTIN-13/14 style check (numeric, 13-14 digits). Kept intentionally
// lightweight for a pilot — production would run the full GS1 check-digit.
const GTIN_REGEX = /^\d{13,14}$/;

function isValidGtin(gtin) {
  return typeof gtin === 'string' && GTIN_REGEX.test(gtin);
}

function buildSgtin(gtin, serial) {
  if (!isValidGtin(gtin)) throw new Error('Invalid GTIN');
  if (!serial) throw new Error('Serial is required to build an SGTIN');
  return `${gtin}.${serial}`;
}

function isValidEvent(bizStep) {
  return VALID_EVENTS.includes(bizStep);
}

/**
 * Enforce the pilot's event-lifecycle ordering rules, e.g. you cannot
 * "dispense" a pack that was never "received", and a "recall" can be
 * raised at any point after commissioning.
 */
const ALLOWED_TRANSITIONS = {
  commission: ['ship', 'recall'],
  ship: ['receive', 'recall'],
  receive: ['dispense', 'ship', 'recall'], // allow re-ship between distributors
  dispense: ['recall'],
  recall: [],
};

function isValidTransition(fromEvent, toEvent) {
  if (!fromEvent) return toEvent === 'commission'; // first event must be commission
  const allowed = ALLOWED_TRANSITIONS[fromEvent] || [];
  return allowed.includes(toEvent);
}

function isExpired(expiryDateISO) {
  if (!expiryDateISO) return false;
  return new Date(expiryDateISO).getTime() < Date.now();
}

module.exports = {
  VALID_EVENTS,
  isValidGtin,
  buildSgtin,
  isValidEvent,
  isValidTransition,
  isExpired,
};
