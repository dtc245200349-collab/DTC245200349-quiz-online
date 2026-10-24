// Local convenience wrapper: passes credentials through environment, never argv/logs.
require('dotenv').config({ quiet: true });
const { spawnSync } = require('node:child_process');
if (!process.env.TEST_DB_USER || !process.env.TEST_DB_PASSWORD) {
  if (process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '3317') {
    console.error('Đặt TEST_DB_USER và TEST_DB_PASSWORD cho tài khoản được phép tạo database kiểm thử mới.');
    process.exit(1);
  }
  process.env.TEST_DB_USER = 'root';
  process.env.TEST_DB_PASSWORD = process.env.MYSQL_ROOT_PASSWORD;
}
const args = process.argv.includes('--browser') ? ['scripts/browser-check.js'] : ['--test','--test-concurrency=1','tests/integration.test.js'];
const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env, windowsHide: true });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
