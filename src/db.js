const mysql = require('mysql2/promise');
function createPool(config) {
  const pool = mysql.createPool(config);
  pool.on('connection', connection => connection.query("SET time_zone = '+00:00'"));
  return pool;
}
async function transaction(pool, work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
module.exports = { createPool, transaction };
