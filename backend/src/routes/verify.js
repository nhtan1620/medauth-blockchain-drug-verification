const express = require('express');
const { validatePackEvent, ChaincodeError } = require('../ledger/chaincode');
const { requireAuth, requireRole } = require('../middleware/auth');
const gs1 = require('../utils/gs1');

function buildVerifyRouter({ db, ledger, offChainStore }) {
  const router = express.Router();

  function getPack(sgtin) {
    return db.prepare('SELECT * FROM packs WHERE sgtin = ?').get(sgtin);
  }

  /**
   * POST /api/events — commission/ship/receive/dispense/recall a pack.
   * Restricted to manufacturer/wholesaler/pharmacist orgs; regulator is
   * read-only (R1, R7). This is the pilot's equivalent of invoking the
   * Fabric chaincode transaction in /chaincode/medauth-pack-lifecycle.
   */
  router.post('/events', requireAuth, requireRole('manufacturer', 'wholesaler', 'pharmacist'), (req, res) => {
    const { gtin, lot, serial, expiry, bizStep, piiPayload } = req.body || {};
    const existingPack = serial && gs1.isValidGtin(gtin) ? getPack(gs1.buildSgtin(gtin, serial)) : null;

    let validated;
    try {
      validated = validatePackEvent({
        gtin,
        lot,
        serial,
        expiry,
        bizStep,
        org: req.user.org,
        lastEvent: existingPack ? existingPack.last_event : null,
      });
    } catch (err) {
      if (err instanceof ChaincodeError) return res.status(422).json({ error: err.message, code: err.code });
      throw err;
    }

    const { sgtin, onChainPayload } = validated;

    // Off-chain artefact (e.g. dispensing record with patient-adjacent
    // context) is stored separately; only its hash anchor goes on-chain.
    let anchor = null;
    if (piiPayload) {
      const stored = offChainStore.put(sgtin, `${bizStep}-record`, piiPayload);
      anchor = stored.anchor;
    }

    const block = ledger.commit({
      org: req.user.org,
      sgtin,
      bizStep,
      payload: anchor ? { ...onChainPayload, anchor } : onChainPayload,
    });

    db.prepare(
      `INSERT INTO packs (sgtin, gtin, lot, serial, expiry, manufacturer, last_event, last_org, updated_at)
       VALUES (@sgtin, @gtin, @lot, @serial, @expiry, @manufacturer, @lastEvent, @lastOrg, @updatedAt)
       ON CONFLICT(sgtin) DO UPDATE SET last_event = @lastEvent, last_org = @lastOrg, updated_at = @updatedAt`
    ).run({
      sgtin,
      gtin,
      lot,
      serial,
      expiry,
      manufacturer: bizStep === 'commission' ? req.user.org : (existingPack ? existingPack.manufacturer : req.user.org),
      lastEvent: bizStep,
      lastOrg: req.user.org,
      updatedAt: block.createdAt,
    });

    return res.status(201).json({ block, sgtin });
  });

  /**
   * POST /api/verify — the mobile app's core scan action. Given a GS1
   * Data Matrix payload (gtin+serial or a raw sgtin), returns one of
   * three decisional states: Authentic | Counterfeit suspected | Barcode not found.
   * Target: p95 <= 1.0s (KPI envelope, R4/R6). No PII is ever returned.
   */
  router.post('/verify', requireAuth, (req, res) => {
    const { gtin, serial, sgtin: rawSgtin } = req.body || {};
    let sgtin = rawSgtin;
    if (!sgtin) {
      if (!gs1.isValidGtin(gtin) || !serial) {
        return res.status(400).json({ status: 'BARCODE_NOT_FOUND', reason: 'Malformed GS1 identifier' });
      }
      sgtin = gs1.buildSgtin(gtin, serial);
    }

    const pack = getPack(sgtin);
    if (!pack) {
      return res.json({ status: 'BARCODE_NOT_FOUND', sgtin });
    }

    if (gs1.isExpired(pack.expiry)) {
      return res.json({
        status: 'COUNTERFEIT_SUSPECTED',
        reason: 'Pack is past its expiry date',
        sgtin,
        lastEvent: pack.last_event,
      });
    }

    // Duplicate-dispense heuristic — the same idea underpinning R11
    // (regulator anomaly view for duplicate UID alerts).
    const trail = ledger.getEventTrail(sgtin);
    const dispenseCount = trail.filter((e) => e.bizStep === 'dispense').length;
    if (dispenseCount > 1) {
      return res.json({
        status: 'COUNTERFEIT_SUSPECTED',
        reason: 'Pack has been dispensed more than once — possible clone/reuse of UID',
        sgtin,
        dispenseCount,
      });
    }

    return res.json({
      status: 'AUTHENTIC',
      sgtin,
      gtin: pack.gtin,
      lot: pack.lot,
      serial: pack.serial,
      expiry: pack.expiry,
      lastEvent: pack.last_event,
      lastOrg: pack.last_org,
      // Small "Anchor" badge data — proves integrity without exposing PII.
      anchor: trail.length ? trail[trail.length - 1].blockHash.slice(0, 12) : null,
    });
  });

  /**
   * POST /api/verify/offline-sync — reconcile a batch of scans that were
   * queued on-device while offline (R5: reconcile within <= 10 minutes
   * of connectivity being restored). Idempotent: replays are safe.
   */
  router.post('/verify/offline-sync', requireAuth, (req, res) => {
    const { scans } = req.body || {};
    if (!Array.isArray(scans)) return res.status(400).json({ error: 'scans must be an array' });

    const results = scans.map((scan) => {
      const sgtin = scan.sgtin || (gs1.isValidGtin(scan.gtin) && scan.serial ? gs1.buildSgtin(scan.gtin, scan.serial) : null);
      if (!sgtin) return { queuedAt: scan.queuedAt, status: 'BARCODE_NOT_FOUND' };
      const pack = getPack(sgtin);
      return {
        sgtin,
        queuedAt: scan.queuedAt,
        reconciledAt: new Date().toISOString(),
        status: pack ? (gs1.isExpired(pack.expiry) ? 'COUNTERFEIT_SUSPECTED' : 'AUTHENTIC') : 'BARCODE_NOT_FOUND',
      };
    });

    return res.json({ reconciled: results.length, results });
  });

  /** GET /api/events/:sgtin — read-only GS1/EPCIS event trail (used by the Event-trail drawer and regulator view). */
  router.get('/events/:sgtin', requireAuth, (req, res) => {
    const trail = ledger.getEventTrail(req.params.sgtin);
    return res.json({ sgtin: req.params.sgtin, trail });
  });

  return router;
}

module.exports = { buildVerifyRouter };
