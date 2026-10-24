const session = require('express-session');
class MysqlSessionStore extends session.Store {
  constructor(pool) { super(); this.pool = pool; }
  get(sid, callback) {
    this.pool.execute('SELECT data FROM sessions WHERE sid = ? AND expires_at > ?', [sid, Date.now()])
      .then(([rows]) => callback(null, rows.length ? JSON.parse(rows[0].data) : null)).catch(callback);
  }
  set(sid, data, callback = () => {}) {
    const expires = data.cookie.expires ? new Date(data.cookie.expires).getTime() : Date.now() + 86400000;
    this.pool.execute('INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)',
      [sid, JSON.stringify(data), expires]).then(() => callback()).catch(callback);
  }
  destroy(sid, callback = () => {}) {
    this.pool.execute('DELETE FROM sessions WHERE sid = ?', [sid]).then(() => callback()).catch(callback);
  }
  touch(sid, data, callback = () => {}) {
    this.pool.execute('UPDATE sessions SET expires_at = ? WHERE sid = ?',
      [new Date(data.cookie.expires).getTime(), sid]).then(() => callback()).catch(callback);
  }
}
module.exports = { MysqlSessionStore };
