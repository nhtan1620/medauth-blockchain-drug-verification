const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * Regulator read-only surface (R1, R11). Deliberately has no POST/PUT —
 * a regulator identity can observe the ledger and raise anomaly alerts,
 * never write pack events.
 */
function buildRegulatorRouter({ db, ledger }) {
  const router = express.Router();

  router.get('/audit/packs', requireAuth, requireRole('regulator'), (req, res) => {
    const packs = db.prepare('SELECT * FROM packs ORDER BY updated_at DESC LIMIT 200').all();
    return res.json({ count: packs.length, packs });
  });

  router.get('/audit/trail/:sgtin', requireAuth, requireRole('regulator'), (req, res) => {
    const trail = ledger.getEventTrail(req.params.sgtin);
    return res.json({ sgtin: req.params.sgtin, trail });
  });

  router.get('/audit/anomalies', requireAuth, requireRole('regulator'), (req, res) => {
    const rows = db.prepare('SELECT sgtin, biz_step FROM ledger_blocks WHERE biz_step = ?').all('dispense');
    const counts = rows.reduce((acc, r) => {
      acc[r.sgtin] = (acc[r.sgtin] || 0) + 1;
      return acc;
    }, {});
    const anomalies = Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([sgtin, count]) => ({ sgtin, dispenseCount: count, reason: 'Duplicate UID dispensed more than once' }));
    return res.json({ anomalies });
  });

  router.get('/audit/ledger-integrity', requireAuth, requireRole('regulator'), (req, res) => {
    return res.json(ledger.verifyIntegrity());
  });

  return router;
}

module.exports = { buildRegulatorRouter };
