# API Reference

Base URL: `http://localhost:4000` (dev). All authenticated routes expect
`Authorization: Bearer <token>`.

## Auth

### `POST /api/auth/onboard`
Register a new identity (demo stand-in for CA/MSP enrolment).
```json
{ "identifier": "pharmacist@citypharmacy.demo", "role": "pharmacist", "org": "CityPharmacy" }
```

### `POST /api/auth/otp/request`
```json
{ "identifier": "pharmacist@citypharmacy.demo" }
```
→ `{ "message": "OTP sent", "expiresAt": "...", "devCode": "123456" }` (devCode is demo-only)

### `POST /api/auth/otp/verify`
```json
{ "identifier": "pharmacist@citypharmacy.demo", "code": "123456" }
```
→ `{ "token": "...", "user": { "id", "identifier", "role", "org" } }`

## Verify (core scan flow)

### `POST /api/verify` — auth required
```json
{ "gtin": "9506000134352", "serial": "SN-100001" }
```
→ one of:
```json
{ "status": "AUTHENTIC", "sgtin": "...", "lot": "...", "expiry": "...", "anchor": "..." }
{ "status": "COUNTERFEIT_SUSPECTED", "reason": "Pack is past its expiry date" }
{ "status": "BARCODE_NOT_FOUND", "sgtin": "..." }
```

### `POST /api/verify/offline-sync` — auth required
Reconciles a batch of scans queued while offline (R5).
```json
{ "scans": [{ "gtin": "9506000134352", "serial": "SN-100001", "queuedAt": "2026-01-01T00:00:00.000Z" }] }
```

### `GET /api/events/:sgtin` — auth required
Returns the full GS1/EPCIS event trail for a pack.

## Pack lifecycle events

### `POST /api/events` — auth required, role: manufacturer/wholesaler/pharmacist
```json
{ "gtin": "9506000134352", "lot": "LOT-2026-A1", "serial": "SN-100001", "expiry": "2027-01-01T00:00:00.000Z", "bizStep": "commission" }
```
`bizStep` ∈ `commission | ship | receive | dispense | recall`.

## Regulator (read-only)

- `GET /api/audit/packs` — role: regulator
- `GET /api/audit/trail/:sgtin` — role: regulator
- `GET /api/audit/anomalies` — role: regulator — duplicate-dispense detection
- `GET /api/audit/ledger-integrity` — role: regulator — hash-chain verification

## Operations

- `GET /health` — liveness probe, no auth
- `GET /api/metrics/kpis` — live KPI envelope, no auth (consider restricting in production)
