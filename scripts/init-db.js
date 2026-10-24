const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { getConfig } = require('../src/config');
async function initialize(dbConfig) {
  const { database, ...connectionConfig } = dbConfig;
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Tên database không hợp lệ.');
  const conn = await mysql.createConnection(connectionConfig);
  try {
    const [existing] = await conn.execute('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', [database]);
    if (!existing.length) await conn.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.changeUser({ database });
    const source = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8').replace(/^--.*$/gm, '');
    for (const statement of source.split(';').map(s => s.trim()).filter(Boolean)) await conn.query(statement);
  } finally { await conn.end(); }
}
if (require.main === module) initialize(getConfig().db).then(() => console.log('Khởi tạo schema thành công; không xóa hay thay thế dữ liệu có sẵn.')).catch(error => { console.error('Khởi tạo database thất bại:', error.message); process.exitCode = 1; });
module.exports = { initialize };
