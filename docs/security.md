# Security Model

## Identity & access

- **Onboarding**: `POST /api/auth/onboard` registers an identity with a
  role (`manufacturer` | `wholesaler` | `pharmacist` | `regulator`) and
  org — the pilot's stand-in for Fabric CA/MSP enrolment. On a real
  Fabric network this maps to `fabric-ca-client register/enroll`.
- **Authentication**: OTP-based (`/api/auth/otp/request` →
  `/api/auth/otp/verify`), matching the mobile wireframes. No passwords
  are stored. Successful verification issues a short-lived (2h) JWT.
- **Authorization (RBAC)**: `requireRole()` middleware restricts
  `POST /api/events` to manufacturer/wholesaler/pharmacist orgs.
  `regulator` identities can only hit `/api/audit/*` read routes — there
  is no write route a regulator credential can call, enforced at both
  the API gateway and, for a real deployment, inside the chaincode
  itself (`_assertNotRegulator` in `packLifecycle.js`).

## Zero-PII-on-chain

Two independent enforcement points reject any ledger write containing a
blocklisted field (`name`, `dob`, `phone`, `email`, `address`,
`nationalId`, …):

1. API gateway: `assertZeroPii` in `backend/src/ledger/chaincode.js`
2. Chaincode: `assertZeroPii` in `chaincode/medauth-pack-lifecycle/lib/packLifecycle.js`

Sensitive artefacts are written to the **off-chain store**
(`backend/src/models/offChainStore.js`) instead, with only a SHA-256
content hash anchored on-chain — see `docs/architecture.md`.

## Transport & storage

- `helmet()` sets standard hardening headers on every API response.
- All ledger blocks are hash-chained (`sha256` over `{prevHash, org,
  sgtin, bizStep, payload, createdAt}`); `GET /api/audit/ledger-integrity`
  lets a regulator verify the chain hasn't been tampered with.
- Production deployment should terminate TLS in front of the API
  gateway and use the Fabric network's own mutual-TLS between peers —
  the chaincode/network guide notes this explicitly.

## Key rotation

CA-issued enrolment certificates (once on real Fabric) should rotate on
a ≤90-day cadence, matching typical pharma compliance cycles — automate
via a scheduled `fabric-ca-client reenroll` job per org (R8).

## Known pilot-scope limitations

- OTP codes are echoed back in the API response (`devCode`) for demo
  purposes only — remove before any real deployment and wire an actual
  SMS/email provider.
- JWT secret defaults to a placeholder in `.env.example` — **must** be
  overridden with a strong secret per environment.
- The local ledger simulation is for development/demo; production
  integrity guarantees come from the real Fabric network described in
  `chaincode/network/README.md`.
