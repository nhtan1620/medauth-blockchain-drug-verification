const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { v4: uuid } = require('uuid');

const TEST_DB = path.join(__dirname, 'tmp-verify.db');

function cleanup() {
  ['', '-wal', '-shm'].forEach((suffix) => {
    const p = TEST_DB + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

describe('MedAuth API', () => {
  let app;
  let db;
  let pharmacistToken;
  let regulatorToken;

  beforeAll(async () => {
    cleanup();
    const created = createApp({ dbPath: TEST_DB });
    app = created.app;
    db = created.db;

    db.prepare('INSERT INTO users (id, identifier, role, org) VALUES (?, ?, ?, ?)').run(
      uuid(), 'pharmacist@test.demo', 'pharmacist', 'CityPharmacy'
    );
    db.prepare('INSERT INTO users (id, identifier, role, org) VALUES (?, ?, ?, ?)').run(
      uuid(), 'regulator@test.demo', 'regulator', 'RegulatorObserver'
    );

    pharmacistToken = await loginAs('pharmacist@test.demo');
    regulatorToken = await loginAs('regulator@test.demo');
  });

  afterAll(() => {
    db.close();
    cleanup();
  });

  async function loginAs(identifier) {
    const otpRes = await request(app).post('/api/auth/otp/request').send({ identifier });
    const { devCode } = otpRes.body;
    const verifyRes = await request(app).post('/api/auth/otp/verify').send({ identifier, code: devCode });
    return verifyRes.body.token;
  }

  test('health check responds ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('OTP login issues a JWT', async () => {
    expect(pharmacistToken).toBeDefined();
    expect(typeof pharmacistToken).toBe('string');
  });

  test('rejects unauthenticated verify requests', async () => {
    const res = await request(app).post('/api/verify').send({ gtin: '9506000134352', serial: 'SN-1' });
    expect(res.status).toBe(401);
  });

  test('full lifecycle then verify returns AUTHENTIC', async () => {
    const pack = { gtin: '9506000134352', lot: 'LOT-1', serial: 'SN-100001', expiry: new Date(Date.now() + 1e10).toISOString() };

    for (const bizStep of ['commission', 'ship', 'receive']) {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({ ...pack, bizStep });
      expect(res.status).toBe(201);
    }

    const verifyRes = await request(app)
      .post('/api/verify')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ gtin: pack.gtin, serial: pack.serial });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.status).toBe('AUTHENTIC');
    expect(verifyRes.body).not.toHaveProperty('name');
  });

  test('unknown pack returns BARCODE_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/verify')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ gtin: '9506000134352', serial: 'SN-DOES-NOT-EXIST' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('BARCODE_NOT_FOUND');
  });

  test('expired pack returns COUNTERFEIT_SUSPECTED', async () => {
    const pack = { gtin: '9506000134369', lot: 'LOT-2', serial: 'SN-200002', expiry: '2001-01-01T00:00:00.000Z' };
    await request(app).post('/api/events').set('Authorization', `Bearer ${pharmacistToken}`).send({ ...pack, bizStep: 'commission' });

    const verifyRes = await request(app)
      .post('/api/verify')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ gtin: pack.gtin, serial: pack.serial });

    expect(verifyRes.body.status).toBe('COUNTERFEIT_SUSPECTED');
  });

  test('pharmacist cannot access regulator-only audit endpoints (RBAC)', async () => {
    const res = await request(app)
      .get('/api/audit/packs')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(res.status).toBe(403);
  });

  test('regulator can read the audit trail (read-only) but has no write route available', async () => {
    const res = await request(app)
      .get('/api/audit/packs')
      .set('Authorization', `Bearer ${regulatorToken}`);
    expect(res.status).toBe(200);

    const writeAttempt = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${regulatorToken}`)
      .send({ gtin: '9506000134352', lot: 'X', serial: 'SN-9', expiry: new Date().toISOString(), bizStep: 'commission' });
    expect(writeAttempt.status).toBe(403);
  });

  test('ledger integrity check reports valid chain', async () => {
    const res = await request(app)
      .get('/api/audit/ledger-integrity')
      .set('Authorization', `Bearer ${regulatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  test('offline sync reconciles queued scans', async () => {
    const res = await request(app)
      .post('/api/verify/offline-sync')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ scans: [{ gtin: '9506000134352', serial: 'SN-100001', queuedAt: new Date().toISOString() }] });
    expect(res.status).toBe(200);
    expect(res.body.reconciled).toBe(1);
    expect(res.body.results[0].status).toBe('AUTHENTIC');
  });
});
