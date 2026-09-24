const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function initDb() {
  // Read at call time (not module load time) so tests and multi-instance
  // setups can point createApp() at a different DB_PATH per call.
  const DB_PATH = process.env.DB_PATH || './data/medauth.db';
  const dir = path.dirname(DB_PATH);
  if (dir !== '.' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Permissioned-ledger blocks (append-only, hash-chained). This is the
  // local index of what a Hyperledger Fabric peer would commit; see
  // /chaincode for the equivalent chaincode logic targeting real Fabric.
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger_blocks (
      block_index   INTEGER PRIMARY KEY AUTOINCREMENT,
      prev_hash     TEXT NOT NULL,
      block_hash    TEXT NOT NULL,
      org           TEXT NOT NULL,
      sgtin         TEXT NOT NULL,
      biz_step      TEXT NOT NULL,
      payload_json  TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );
  `);

  // Off-chain secure store: PII/PHI and documents never touch the ledger.
  // Only their content-hash anchor is written to ledger_blocks.payload_json.
  db.exec(`
    CREATE TABLE IF NOT EXISTS offchain_artefacts (
      id            TEXT PRIMARY KEY,
      sgtin         TEXT NOT NULL,
      kind          TEXT NOT NULL,
      content_json  TEXT NOT NULL,
      anchor_hash   TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );
  `);

  // Pack registry: current known state per SGTIN, used for O(1) verify lookups.
  db.exec(`
    CREATE TABLE IF NOT EXISTS packs (
      sgtin         TEXT PRIMARY KEY,
      gtin          TEXT NOT NULL,
      lot           TEXT NOT NULL,
      serial        TEXT NOT NULL,
      expiry        TEXT NOT NULL,
      manufacturer  TEXT NOT NULL,
      last_event    TEXT NOT NULL,
      last_org      TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
  `);

  // RBAC users. Passwords are never used for the pilot demo — access is
  // via OTP, matching the wireframes (Get OTP -> Enter Code).
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      identifier    TEXT UNIQUE NOT NULL,
      role          TEXT NOT NULL,
      org           TEXT NOT NULL
    );
  `);

  // In-memory-ish OTP store, persisted so a restart mid-demo doesn't break it.
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      identifier    TEXT PRIMARY KEY,
      code          TEXT NOT NULL,
      expires_at    TEXT NOT NULL
    );
  `);

  // Verification latency samples, used to compute the p95 KPI live.
  db.exec(`
    CREATE TABLE IF NOT EXISTS latency_samples (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      route         TEXT NOT NULL,
      duration_ms   REAL NOT NULL,
      created_at    TEXT NOT NULL
    );
  `);

  return db;
}

module.exports = { initDb };
