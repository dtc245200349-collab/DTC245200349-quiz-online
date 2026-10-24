const { getConfig } = require('./config');
const { createPool } = require('./db');
const { createApp } = require('./app');
const { expireAttempts } = require('./services/attempts');

async function main() {
  const config = getConfig(), pool = createPool(config.db);
  await pool.execute('SELECT id FROM users LIMIT 1');
  await pool.execute('SELECT sid FROM sessions LIMIT 1');
  await expireAttempts(pool);
  const server = createApp({ pool, config }).listen(config.port, '0.0.0.0', () => console.log(`Quiz Online đang chạy: http://localhost:${config.port}`));
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await expireAttempts(pool);
      await pool.execute('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
    } catch (error) { console.error('Không thể xử lý bài hết giờ:', error.code || error.name); }
    finally { running = false; }
  }, 15000);
  timer.unref();
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {
    clearInterval(timer);
    server.close(async () => { await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
  server.on('error', error => { console.error('Không thể mở cổng HTTP:', error.code); process.exit(1); });
}
main().catch(error => { console.error('Khởi động thất bại:', error.message); process.exit(1); });
