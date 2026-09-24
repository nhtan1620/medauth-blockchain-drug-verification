const crypto = require('crypto');

/**
 * Zero-PII-on-chain principle: anything sensitive (PII/PHI, invoices,
 * documents) is stored off-chain. Only a SHA-256 content hash ("anchor")
 * of that artefact is written to the permissioned ledger, so integrity
 * can be proven without exposing the underlying data.
 */
function sha256(input) {
  const payload = typeof input === 'string' ? input : JSON.stringify(input);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function makeAnchor(offChainArtefact) {
  return {
    algorithm: 'SHA-256',
    hash: sha256(offChainArtefact),
    anchoredAt: new Date().toISOString(),
  };
}

function verifyAnchor(offChainArtefact, anchor) {
  if (!anchor || anchor.algorithm !== 'SHA-256') return false;
  return sha256(offChainArtefact) === anchor.hash;
}

module.exports = { sha256, makeAnchor, verifyAnchor };
