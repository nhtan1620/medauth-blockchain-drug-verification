const { sha256 } = require('../utils/hash');

const GENESIS_HASH = '0'.repeat(64);

/**
 * PermissionedLedger simulates the write-path of a permissioned
 * Hyperledger Fabric channel for local development and the pilot demo:
 * append-only, hash-chained blocks, one block per validated event.
 *
 * In production this class is replaced by a Fabric Gateway SDK client
 * invoking the chaincode in /chaincode/medauth-pack-lifecycle — the
 * validation rules there are identical, so swapping the transport does
 * not change business behaviour.
 */
class PermissionedLedger {
  constructor(db) {
    this.db = db;
  }

  getLastBlock() {
    return this.db
      .prepare('SELECT * FROM ledger_blocks ORDER BY block_index DESC LIMIT 1')
      .get();
  }

  /**
   * Commit a pack-lifecycle event as a new ledger block.
   * `payload` must already have PII stripped — see zeroPii guard in
   * chaincode/packLifecycleValidator.js, invoked before this is called.
   */
  commit({ org, sgtin, bizStep, payload }) {
    const last = this.getLastBlock();
    const prevHash = last ? last.block_hash : GENESIS_HASH;
    const createdAt = new Date().toISOString();
    const blockCore = { prevHash, org, sgtin, bizStep, payload, createdAt };
    const blockHash = sha256(blockCore);

    const stmt = this.db.prepare(`
      INSERT INTO ledger_blocks (prev_hash, block_hash, org, sgtin, biz_step, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(prevHash, blockHash, org, sgtin, bizStep, JSON.stringify(payload), createdAt);

    return {
      blockIndex: result.lastInsertRowid,
      blockHash,
      prevHash,
      org,
      sgtin,
      bizStep,
      payload,
      createdAt,
    };
  }

  getEventTrail(sgtin) {
    return this.db
      .prepare('SELECT * FROM ledger_blocks WHERE sgtin = ? ORDER BY block_index ASC')
      .all(sgtin)
      .map((row) => ({
        blockIndex: row.block_index,
        org: row.org,
        bizStep: row.biz_step,
        payload: JSON.parse(row.payload_json),
        blockHash: row.block_hash,
        prevHash: row.prev_hash,
        createdAt: row.created_at,
      }));
  }

  /**
   * Verify the hash chain has not been tampered with — the same check a
   * regulator observer or auditor would run over the ledger.
   */
  verifyIntegrity() {
    const rows = this.db.prepare('SELECT * FROM ledger_blocks ORDER BY block_index ASC').all();
    let expectedPrev = GENESIS_HASH;
    for (const row of rows) {
      if (row.prev_hash !== expectedPrev) {
        return { valid: false, brokenAtBlock: row.block_index };
      }
      const recomputed = sha256({
        prevHash: row.prev_hash,
        org: row.org,
        sgtin: row.sgtin,
        bizStep: row.biz_step,
        payload: JSON.parse(row.payload_json),
        createdAt: row.created_at,
      });
      if (recomputed !== row.block_hash) {
        return { valid: false, brokenAtBlock: row.block_index };
      }
      expectedPrev = row.block_hash;
    }
    return { valid: true, blocks: rows.length };
  }
}

module.exports = { PermissionedLedger, GENESIS_HASH };
