require('dotenv').config();
const fs = require('fs');
const path = require('path');
const app = require('./app');
const { pool } = require('./config/database');
const { startDevicePolling } = require('./services/devicePoller');
const { startTokenCleanup } = require('./services/tokenCleanup');

const PORT = process.env.PORT || 4000;

const start = async () => {
  fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });

  // Verify DB connection
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connection verified');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Make sure PostgreSQL is running and .env is configured.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Health check: http://localhost:${PORT}/health\n`);
  });

  startDevicePolling();
  startTokenCleanup();
};

start();
