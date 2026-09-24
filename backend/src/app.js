const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { initDb } = require('./db/init');
const { PermissionedLedger } = require('./ledger/permissionedLedger');
const { OffChainStore } = require('./models/offChainStore');
const { metricsMiddleware } = require('./middleware/metrics');

const { buildAuthRouter } = require('./routes/auth');
const { buildVerifyRouter } = require('./routes/verify');
const { buildRegulatorRouter } = require('./routes/regulator');
const { buildMetricsRouter } = require('./routes/metrics');

function createApp({ dbPath } = {}) {
  if (dbPath) process.env.DB_PATH = dbPath;
  const db = initDb();
  const ledger = new PermissionedLedger(db);
  const offChainStore = new OffChainStore(db);

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(metricsMiddleware(db));

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'medauth-backend' }));

  app.use('/api/auth', buildAuthRouter(db));
  app.use('/api', buildVerifyRouter({ db, ledger, offChainStore }));
  app.use('/api', buildRegulatorRouter({ db, ledger }));
  app.use('/api', buildMetricsRouter(db));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, db, ledger, offChainStore };
}

module.exports = { createApp };
