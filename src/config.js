require('dotenv').config({ quiet: true });

function getConfig(env = process.env) {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'SESSION_SECRET'];
  for (const key of required) if (!env[key]) throw new Error(`Thiếu ${key}. Chạy npm.cmd run setup:env và kiểm tra .env.`);
  if (env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET phải có ít nhất 32 ký tự.');
  if (!/^[a-zA-Z0-9_]+$/.test(env.DB_NAME)) throw new Error('DB_NAME chỉ được chứa chữ, số và dấu gạch dưới.');
  const port = Number(env.PORT || 3000);
  const dbPort = Number(env.DB_PORT || 3306);
  if (![port, dbPort].every(p => Number.isInteger(p) && p > 0 && p <= 65535)) throw new Error('PORT hoặc DB_PORT không hợp lệ.');
  return {
    port, secret: env.SESSION_SECRET, secure: env.COOKIE_SECURE === 'true',
    trustProxy: env.TRUST_PROXY === '1' ? 1 : false,
    db: { host: env.DB_HOST, port: dbPort, user: env.DB_USER, password: env.DB_PASSWORD,
      database: env.DB_NAME, charset: 'utf8mb4', timezone: 'Z', decimalNumbers: true,
      waitForConnections: true, connectionLimit: 10, multipleStatements: false }
  };
}
module.exports = { getConfig };
