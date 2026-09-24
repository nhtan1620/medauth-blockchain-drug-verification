require('dotenv').config();
const { v4: uuid } = require('uuid');
const { createApp } = require('../src/app');
const { validatePackEvent } = require('../src/ledger/chaincode');

function upsertUser(db, identifier, role, org) {
  const existing = db.prepare('SELECT * FROM users WHERE identifier = ?').get(identifier);
  if (existing) return existing;
  const id = uuid();
  db.prepare('INSERT INTO users (id, identifier, role, org) VALUES (?, ?, ?, ?)').run(id, identifier, role, org);
  return { id, identifier, role, org };
}

function commitEvent(db, ledger, { gtin, lot, serial, expiry, bizStep, org }) {
  const sgtin = `${gtin}.${serial}`;
  const existingPack = db.prepare('SELECT * FROM packs WHERE sgtin = ?').get(sgtin);
  const { onChainPayload } = validatePackEvent({
    gtin,
    lot,
    serial,
    expiry,
    bizStep,
    org,
    lastEvent: existingPack ? existingPack.last_event : null,
  });
  const block = ledger.commit({ org, sgtin, bizStep, payload: onChainPayload });
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
    manufacturer: existingPack ? existingPack.manufacturer : org,
    lastEvent: bizStep,
    lastOrg: org,
    updatedAt: block.createdAt,
  });
  return block;
}

function seed() {
  const { db, ledger } = createApp({ dbPath: process.env.DB_PATH || './data/medauth.db' });

  console.log('Seeding demo identities (CA/MSP-style onboarding, R1)...');
  upsertUser(db, 'manufacturer@wissen-pharma.demo', 'manufacturer', 'WissenPharma');
  upsertUser(db, 'wholesaler@medidist.demo', 'wholesaler', 'MediDist');
  upsertUser(db, 'pharmacist@citypharmacy.demo', 'pharmacist', 'CityPharmacy');
  upsertUser(db, 'regulator@tga.gov.demo', 'regulator', 'RegulatorObserver');

  console.log('Seeding a full pack lifecycle: commission -> ship -> receive -> dispense...');
  const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
  const genuinePack = { gtin: '9506000134352', lot: 'LOT-2026-A1', serial: 'SN-100001', expiry: futureExpiry };

  commitEvent(db, ledger, { ...genuinePack, bizStep: 'commission', org: 'WissenPharma' });
  commitEvent(db, ledger, { ...genuinePack, bizStep: 'ship', org: 'WissenPharma' });
  commitEvent(db, ledger, { ...genuinePack, bizStep: 'receive', org: 'MediDist' });
  commitEvent(db, ledger, { ...genuinePack, bizStep: 'ship', org: 'MediDist' });
  commitEvent(db, ledger, { ...genuinePack, bizStep: 'receive', org: 'CityPharmacy' });

  console.log('Seeding an expired pack (should verify as COUNTERFEIT_SUSPECTED)...');
  const expiredPack = {
    gtin: '9506000134369',
    lot: 'LOT-2023-B7',
    serial: 'SN-200002',
    expiry: '2023-01-01T00:00:00.000Z',
  };
  commitEvent(db, ledger, { ...expiredPack, bizStep: 'commission', org: 'WissenPharma' });

  console.log('\nDemo data ready. Sample scans to try against /api/verify:');
  console.log('  Authentic         -> gtin=9506000134352 serial=SN-100001');
  console.log('  Counterfeit (exp) -> gtin=9506000134369 serial=SN-200002');
  console.log('  Not found         -> gtin=9506000134352 serial=SN-999999');
  console.log('\nDemo accounts (OTP flow — call POST /api/auth/otp/request then /otp/verify):');
  console.log('  manufacturer@wissen-pharma.demo / wholesaler@medidist.demo / pharmacist@citypharmacy.demo / regulator@tga.gov.demo');

  db.close();
}

seed();
