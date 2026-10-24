const crypto = require('node:crypto');
const { HttpError } = require('../lib/validation');
function csrf(req, res, next) {
  req.session.csrfToken ||= crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.get('X-CSRF-Token') || req.body?._csrf;
  if (typeof token !== 'string' || Buffer.byteLength(token) !== Buffer.byteLength(req.session.csrfToken) ||
      !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(req.session.csrfToken)))
    return next(new HttpError(403, 'Phiên biểu mẫu không hợp lệ. Vui lòng tải lại trang và thử lại.'));
  next();
}
function loadUser(pool) {
  return async (req, res, next) => {
    req.user = null;
    if (req.session.userId) {
      const [rows] = await pool.execute('SELECT id, name, email, role, active FROM users WHERE id = ?', [req.session.userId]);
      if (rows[0]?.active) req.user = rows[0];
      else delete req.session.userId;
    }
    res.locals.user = req.user;
    next();
  };
}
function requireUser(req, res, next) {
  if (req.user) return next();
  if (req.is('application/json')) return res.status(401).json({ error: 'Vui lòng đăng nhập lại.' });
  res.redirect('/login');
}
function requireRole(role) {
  return [requireUser, (req, res, next) => req.user.role === role ? next() : next(new HttpError(403, 'Bạn không có quyền truy cập chức năng này.'))];
}
function flash(req, type, message) { req.session.flash = { type, message }; }
module.exports = { csrf, loadUser, requireUser, requireRole, flash };
