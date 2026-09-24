require('dotenv').config();
const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;
const { app } = createApp();

app.listen(PORT, () => {
  console.log(`MedAuth backend listening on http://localhost:${PORT}`);
  console.log('Try: curl http://localhost:' + PORT + '/health');
});
