const express = require('express');
const { computeKpis } = require('../middleware/metrics');

function buildMetricsRouter(db) {
  const router = express.Router();

  router.get('/metrics/kpis', (req, res) => {
    return res.json(computeKpis(db));
  });

  return router;
}

module.exports = { buildMetricsRouter };
