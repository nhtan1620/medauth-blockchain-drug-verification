# Contributing to MedAuth

Thanks for your interest in improving MedAuth — a permissioned-blockchain
medication authenticity verification pilot.

## Project layout

- `backend/` — API gateway + local ledger simulation (Node.js/Express)
- `chaincode/medauth-pack-lifecycle/` — the real Hyperledger Fabric smart contract
- `chaincode/network/` — Fabric deployment guide
- `mobile-app/` — Expo/React Native scan-and-verify client
- `docs/` — architecture, GS1/EPCIS mapping, security, KPIs, API reference

## Getting set up

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run seed
npm run dev

# Chaincode unit tests (no Fabric network required)
cd chaincode/medauth-pack-lifecycle
npm install
npm test

# Mobile app
cd mobile-app
npm install
npm start
```

## Before opening a PR

1. `npm test` passes in `backend/` and `chaincode/medauth-pack-lifecycle/`.
2. `npm run typecheck` passes in `mobile-app/`.
3. New pack-lifecycle rules are added to **both**
   `backend/src/ledger/chaincode.js` and
   `chaincode/medauth-pack-lifecycle/lib/packLifecycle.js` — they must
   stay in sync, since the API gateway's simulation exists specifically
   to mirror the real chaincode's behaviour.
4. Anything added to an on-chain payload is checked against the
   zero-PII-on-chain guard (`assertZeroPii`) in both locations above.

## Reporting security issues

Please do not open a public issue for security-sensitive findings
(e.g. a way to leak PII on-chain, bypass RBAC, or forge a ledger block).
Open a private security advisory on this repository instead.
