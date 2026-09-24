/**
 * Tracks per-request latency so the /metrics endpoint can report the
 * pilot KPI envelope live: verify p95 <= 1.0s, throughput >= 25 TPS,
 * availability >= 99.9% (Success Matrix, Section 3.3 / R6).
 */
function metricsMiddleware(db) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      try {
        db.prepare(
          `INSERT INTO latency_samples (route, duration_ms, created_at) VALUES (?, ?, ?)`
        ).run(req.path, durationMs, new Date().toISOString());
      } catch (_) {
        /* metrics must never break the request lifecycle */
      }
    });
    next();
  };
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(idx, sortedValues.length - 1))];
}

function computeKpis(db, { windowSeconds = 3600 } = {}) {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const rows = db
    .prepare(
      `SELECT duration_ms FROM latency_samples WHERE route = '/api/verify' AND created_at >= ? ORDER BY duration_ms ASC`
    )
    .all(since)
    .map((r) => r.duration_ms);

  const totalRequests = rows.length;
  const p95Ms = percentile(rows, 95);
  const throughputTps = totalRequests / windowSeconds;

  return {
    windowSeconds,
    sampleCount: totalRequests,
    verifyP95Ms: Number(p95Ms.toFixed(2)),
    verifyP95TargetMs: Number(process.env.KPI_VERIFY_P95_MS || 1000),
    throughputTps: Number(throughputTps.toFixed(2)),
    throughputTargetTps: Number(process.env.KPI_MIN_TPS || 25),
    p95WithinTarget: p95Ms <= Number(process.env.KPI_VERIFY_P95_MS || 1000),
  };
}

module.exports = { metricsMiddleware, computeKpis, percentile };
