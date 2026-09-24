const { v4: uuid } = require('uuid');
const { makeAnchor, verifyAnchor } = require('../utils/hash');

/**
 * Off-chain store for anything that must never touch the permissioned
 * ledger: PII/PHI, invoices, supporting documents. Each artefact gets a
 * SHA-256 anchor which IS written on-chain, proving integrity without
 * exposing content (Objective 3 — Privacy-first partitioning).
 */
class OffChainStore {
  constructor(db) {
    this.db = db;
  }

  put(sgtin, kind, content) {
    const id = uuid();
    const anchor = makeAnchor(content);
    this.db
      .prepare(
        `INSERT INTO offchain_artefacts (id, sgtin, kind, content_json, anchor_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, sgtin, kind, JSON.stringify(content), anchor.hash, anchor.anchoredAt);
    return { id, anchor };
  }

  get(id) {
    const row = this.db.prepare('SELECT * FROM offchain_artefacts WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      sgtin: row.sgtin,
      kind: row.kind,
      content: JSON.parse(row.content_json),
      anchorHash: row.anchor_hash,
      createdAt: row.created_at,
    };
  }

  /** Re-hash the stored content and compare against the anchor written on-chain. */
  checkIntegrity(id, onChainAnchor) {
    const artefact = this.get(id);
    if (!artefact) return { valid: false, reason: 'ARTEFACT_NOT_FOUND' };
    const valid = verifyAnchor(artefact.content, onChainAnchor);
    return { valid, artefact };
  }
}

module.exports = { OffChainStore };
