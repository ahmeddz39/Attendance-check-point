const { query } = require('../config/database');

const INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

let timer = null;

const cleanupOnce = async () => {
  try {
    const { rowCount } = await query(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
    if (rowCount > 0) {
      console.log(`🧹 Cleaned up ${rowCount} expired refresh token(s)`);
    }
  } catch (err) {
    console.error('⚠️  Refresh token cleanup failed:', err.message);
  }
};

const startTokenCleanup = () => {
  if (timer) return;
  timer = setInterval(cleanupOnce, INTERVAL_MS);
  timer.unref?.();
  cleanupOnce();
};

const stopTokenCleanup = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = { startTokenCleanup, stopTokenCleanup };
