const express = require('express');
const bcrypt = require('bcrypt');
const { rateLimit } = require('express-rate-limit');
const v = require('../lib/validation');
const { flash } = require('../middleware/security');

function authRoutes(pool) {
  const router = express.Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res, next) => next(new v.HttpError(429, 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.')) });
  const show = mode => (req, res) => req.user ? res.redirect(req.user.role === 'admin' ? '/admin' : '/exams') : res.render('auth', { title: mode === 'login' ? 'Đăng nhập' : 'Đăng ký', mode, error: null, values: {} });
  router.get('/login', show('login'));
  router.get('/register', show('register'));
  router.post('/register', limiter, async (req, res, next) => {
    try {
      const name = v.text(req.body.name, 'Họ tên', 2, 100), email = v.email(req.body.email), password = v.password(req.body.password);
      if (password !== req.body.confirm_password) throw new v.HttpError(400, 'Mật khẩu xác nhận không khớp.');
      const hash = await bcrypt.hash(password, 12);
      await pool.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, \'student\')', [name, email, hash]);
      flash(req, 'success', 'Đăng ký thành công. Bạn có thể đăng nhập ngay.');
      res.redirect('/login');
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') error = new v.HttpError(400, 'Email đã được đăng ký.');
      if (error.status === 400) return res.status(400).render('auth', { title: 'Đăng ký', mode: 'register', error: error.message, values: { name: req.body.name, email: req.body.email } });
      next(error);
    }
  });
  router.post('/login', limiter, async (req, res, next) => {
    try {
      const email = v.email(req.body.email), password = v.password(req.body.password);
      const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
      const user = rows[0];
      if (!user || !await bcrypt.compare(password, user.password_hash) || !user.active)
        throw new v.HttpError(400, 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.');
      await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
      req.session.userId = user.id;
      await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
      res.redirect(user.role === 'admin' ? '/admin' : '/exams');
    } catch (error) {
      if (error.status === 400) return res.status(400).render('auth', { title: 'Đăng nhập', mode: 'login', error: error.message, values: { email: req.body.email } });
      next(error);
    }
  });
  router.post('/logout', (req, res, next) => req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('quiz.sid', { path: '/' }); res.redirect('/login');
  }));
  return router;
}
module.exports = { authRoutes };
