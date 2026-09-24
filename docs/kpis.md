# KPI Envelope

The pilot's success matrix defines three operating targets, all
measurable live via `GET /api/metrics/kpis`:

| KPI | Target | How it's measured |
|---|---|---|
| Verify latency (p95) | ≤ 1.0s | `latency_samples` table, filtered to `/api/verify`, p95 over a rolling window (`backend/src/middleware/metrics.js`) |
| Throughput | ≥ 25 TPS | Sample count ÷ window size, same table |
| Availability | ≥ 99.9% | Not yet wired to a real uptime probe in the pilot — recommended follow-up: an external synthetic monitor hitting `/health` |

## Example response

```json
{
  "windowSeconds": 3600,
  "sampleCount": 812,
  "verifyP95Ms": 184.32,
  "verifyP95TargetMs": 1000,
  "throughputTps": 0.23,
  "throughputTargetTps": 25,
  "p95WithinTarget": true
}
```

Throughput will read low in a lightly-loaded pilot/demo environment —
it's a *live* measurement, not a synthetic benchmark. To load-test
against the 25 TPS target, point a tool like `autocannon` or `k6` at
`POST /api/verify` with a pool of seeded SGTINs.

## Follow-ups for a production rollout

- Add an external uptime probe for the availability KPI.
- Add full GTIN check-digit validation (currently pattern-only — see
  `docs/gs1-epcis-mapping.md`).
- Wire `backend/src/ledger/permissionedLedger.js` to a real Fabric
  Gateway client so latency numbers include actual endorsement/ordering
  time, not just the local SQLite write path.
