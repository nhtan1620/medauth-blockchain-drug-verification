const express = require('express');
const { v4: uuid } = require('uuid');
const { signToken } = require('../middleware/auth');

function buildAuthRouter(db) {
  const router = express.Router();

  // Step 1: request an OTP for a known identifier (phone/email).
  router.post('/otp/request', (req, res) => {
    const { identifier } = req.body || {};
    if (!identifier) return res.status(400).json({ error: 'identifier is required' });

    const user = db.prepare('SELECT * FROM users WHERE identifier = ?').get(identifier);
    if (!user) return res.status(404).json({ error: 'Unknown identifier — ask WISSEN admin to onboard this account' });

    // Deterministic 6-digit code for the pilot demo. A real deployment
    // sends this via SMS/email provider instead of returning it in-band.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.prepare(
      `INSERT INTO otp_codes (identifier, code, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(identifier) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at`
    ).run(identifier, code, expiresAt);

    // Demo-only: echo the code back so the reviewer can test end-to-end
    // without wiring a real SMS provider. Remove `devCode` before production.
    return res.json({ message: 'OTP sent', expiresAt, devCode: code });
  });

  // Step 2: verify the OTP and issue a JWT scoped to the user's role/org.
  router.post('/otp/verify', (req, res) => {
    const { identifier, code } = req.body || {};
    if (!identifier || !code) return res.status(400).json({ error: 'identifier and code are required' });

    const record = db.prepare('SELECT * FROM otp_codes WHERE identifier = ?').get(identifier);
    if (!record || record.code !== code) return res.status(401).json({ error: 'Invalid code' });
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: 'Code expired — request a new one' });
    }

    const user = db.prepare('SELECT * FROM users WHERE identifier = ?').get(identifier);
    const token = signToken(user);
    db.prepare('DELETE FROM otp_codes WHERE identifier = ?').run(identifier);

    return res.json({ token, user: { id: user.id, identifier: user.identifier, role: user.role, org: user.org } });
  });

  // Onboarding helper for the pilot (CA/MSP-style identity registration, R1).
  router.post('/onboard', (req, res) => {
    const { identifier, role, org } = req.body || {};
    const allowedRoles = ['manufacturer', 'wholesaler', 'pharmacist', 'regulator'];
    if (!identifier || !allowedRoles.includes(role) || !org) {
      return res.status(400).json({ error: `identifier, org and role (one of ${allowedRoles.join(', ')}) are required` });
    }
    const id = uuid();
    db.prepare('INSERT INTO users (id, identifier, role, org) VALUES (?, ?, ?, ?)').run(id, identifier, role, org);
    return res.status(201).json({ id, identifier, role, org });
  });

  return router;
}

module.exports = { buildAuthRouter };
