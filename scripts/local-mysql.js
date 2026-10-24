// Optional Windows helper: an isolated MySQL instance, never the existing Windows service.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const mysql = require('mysql2/promise');
const { getConfig } = require('../src/config');

async function main() {
  const config = getConfig();
  if (config.db.host !== '127.0.0.1' || config.db.port !== 3317) throw new Error('Helper chỉ dành cho DB_HOST=127.0.0.1 và DB_PORT=3317. Không tác động MySQL đang có.');
  const binary = process.env.MYSQLD_PATH || 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqld.exe';
  if (!fs.existsSync(binary)) throw new Error('Không tìm thấy mysqld.exe. Đặt MYSQLD_PATH hoặc sử dụng Docker.');
  const runtime = path.resolve(__dirname, '../.runtime/mysql');
  const data = path.join(runtime, 'data');
  // MySQL's Windows binary cannot parse a Unicode datadir. An ASCII junction
  // points to the same project-owned directory; no data is moved or removed.
  const mysqlData = process.platform === 'win32' && /[^\x00-\x7f]/.test(data)
    ? path.join(os.tmpdir(), 'quiz-mysql-' + crypto.createHash('sha256').update(data).digest('hex').slice(0,12)) : data;
  const isOwnedData = actual => fs.realpathSync(actual).toLowerCase() === fs.realpathSync(data).toLowerCase();
  const marker = path.join(runtime, 'owned-instance.json');
  const portUsed = await new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 3317 });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
  if (portUsed) {
    if (!fs.existsSync(marker)) throw new Error('Cổng 3317 đã được sử dụng. Không can thiệp tiến trình đang chạy.');
    const conn = await mysql.createConnection(config.db);
    const [[row]] = await conn.query('SELECT @@datadir AS datadir');
    await conn.end();
    if (!isOwnedData(row.datadir)) throw new Error('Cổng 3317 không thuộc thư mục dữ liệu dự án.');
    console.log('MySQL riêng của dự án đã chạy ở cổng 3317.'); return;
  }
  fs.mkdirSync(runtime, { recursive: true });
  const fresh = !fs.existsSync(data) || fs.readdirSync(data).length === 0;
  if (!fresh && !fs.existsSync(marker)) throw new Error('Thư mục dữ liệu đã tồn tại nhưng chưa được xác minh. Không tự ghi đè.');
  if (fresh) {
    fs.mkdirSync(data, { recursive: true });
    if (mysqlData !== data) {
      if (!fs.existsSync(mysqlData)) fs.symlinkSync(data, mysqlData, 'junction');
      if (!isOwnedData(mysqlData)) throw new Error('Junction tạm không trỏ đến dữ liệu dự án.');
    }
    const result = spawnSync(binary, ['--no-defaults', '--initialize-insecure', `--datadir=${mysqlData}`, '--console'], { cwd: path.dirname(binary), windowsHide: true, encoding: 'utf8', timeout: 60000 });
    fs.writeFileSync(path.join(runtime, 'initialize.log'), (result.stdout || '') + (result.stderr || '') + (result.error?.message || ''));
    if (result.status !== 0) throw new Error('Khởi tạo MySQL thất bại. Xem .runtime/mysql/initialize.log.');
    fs.writeFileSync(marker, JSON.stringify({ data, port: 3317, secured: false }, null, 2));
  }
  if (mysqlData !== data && !fs.existsSync(mysqlData)) fs.symlinkSync(data, mysqlData, 'junction');
  if (!isOwnedData(mysqlData)) throw new Error('Đường dẫn MySQL riêng không hợp lệ.');
  const log = fs.openSync(path.join(runtime, 'server.log'), 'a');
  const child = spawn(binary, ['--no-defaults', `--datadir=${mysqlData}`, '--port=3317', '--bind-address=127.0.0.1', '--mysqlx=OFF', '--default-time-zone=+00:00', '--console'], { cwd: path.dirname(binary), detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  child.on('error', error => console.error('Không chạy được MySQL:', error.message));
  child.unref(); fs.closeSync(log);
  fs.writeFileSync(path.join(runtime, 'pid'), String(child.pid));
  const ownership = JSON.parse(fs.readFileSync(marker, 'utf8'));
  let conn;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { conn = await mysql.createConnection({ host: '127.0.0.1', port: 3317, user: 'root', password: ownership.secured ? process.env.MYSQL_ROOT_PASSWORD : '', multipleStatements: false }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  if (!conn) throw new Error('Không kết nối được MySQL riêng. Xem .runtime/mysql/server.log.');
  try {
    const [[row]] = await conn.query('SELECT @@datadir AS datadir');
    if (!isOwnedData(row.datadir)) throw new Error('Đường dẫn MySQL không khớp, dừng cấu hình.');
    if (!ownership.secured) {
      if (!process.env.MYSQL_ROOT_PASSWORD) throw new Error('Thiếu MYSQL_ROOT_PASSWORD.');
      // mysql2 escapes values in administrative statements that cannot be prepared.
      await conn.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [process.env.MYSQL_ROOT_PASSWORD]);
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.query("CREATE USER ?@'%' IDENTIFIED BY ?", [config.db.user, config.db.password]);
      await conn.query(`GRANT ALL PRIVILEGES ON \`${config.db.database}\`.* TO ?@'%'`, [config.db.user]);
      fs.writeFileSync(marker, JSON.stringify({ ...ownership, secured: true }, null, 2));
    }
  } finally { await conn.end(); }
  console.log('MySQL riêng đã chạy ở 127.0.0.1:3317; dữ liệu: .runtime/mysql/data.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
