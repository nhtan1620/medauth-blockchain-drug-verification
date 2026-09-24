# GS1 / EPCIS Mapping

MedAuth aligns pack-level identity and lifecycle events to GS1 standards
so the ledger stays interoperable with existing pharma track-and-trace
tooling.

## Identifiers

| Concept | GS1 term | Used as |
|---|---|---|
| Product code | GTIN (13–14 digit) | `gtin` |
| Unique unit | SGTIN (`GTIN.serial`) | `sgtin` — the ledger's primary key |
| Batch | Lot/batch number | `lot` |
| Expiry | Expiration date | `expiry` |
| Unit serial | Serial number | `serial` |

## Lifecycle events → GS1 EPCIS `bizStep` (CBV-style)

| MedAuth event | GS1 EPCIS bizStep equivalent | Raised by |
|---|---|---|
| `commission` | `commissioning` | Manufacturer |
| `ship` | `shipping` | Manufacturer / Wholesaler |
| `receive` | `receiving` | Wholesaler / Pharmacy |
| `dispense` | `dispensing` | Pharmacy |
| `recall` | `recalling` | Manufacturer / Regulator-triggered |

## Allowed transitions

```
commission -> ship -> receive -> dispense
                 \-> ship (re-distribution)
any state -> recall
```

Implemented identically in:
- `backend/src/utils/gs1.js` (`ALLOWED_TRANSITIONS`)
- `chaincode/medauth-pack-lifecycle/lib/packLifecycle.js` (`ALLOWED_TRANSITIONS`)

## Data Matrix payload format

The mobile app parses a GS1 Application Identifier (AI) string such as:

```
(01)09506000134352(21)SN-100001
```

`01` = GTIN AI, `21` = Serial AI. See `mobile-app/src/screens/ScanScreen.tsx`
(`parseGs1Payload`) for the parsing logic, with a manual-entry fallback
for damaged or non-GS1 barcodes.

## Deliberate simplifications for the pilot

- GTIN check-digit validation is not implemented (pattern match only) —
  flagged as a follow-up in `docs/kpis.md`.
- Only a subset of EPCIS event fields are modelled (no `bizLocation`/
  `readPoint` GLNs yet) — the schema is additive, so these can be added
  to `onChainPayload` without breaking existing blocks.
