const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const { MysqlSessionStore } = require('./session-store');
const { csrf, loadUser } = require('./middleware/security');
const { authRoutes } = require('./routes/auth');
const { studentRoutes } = require('./routes/student');
const { adminRoutes } = require('./routes/admin');

function createApp({ pool, config, sessionStore }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(helmet({ contentSecurityPolicy: { directives: { 'script-src': ["'self'"], 'style-src': ["'self'"], 'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': config.secure ? [] : null } }, strictTransportSecurity: config.secure ? undefined : false }));
  app.use('/assets', express.static(path.join(__dirname, '../public'), { maxAge: '1h' }));
  app.use('/vendor/bootstrap', express.static(path.join(__dirname, '../node_modules/bootstrap/dist'), { maxAge: '1d' }));
  app.get('/health', async (req, res) => {
    try { await pool.execute('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
    catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }); }
  });
  app.use(express.urlencoded({ extended: true, limit: '64kb', parameterLimit: 1000 }));
  app.use(express.json({ limit: '64kb' }));
  app.use(session({ name: 'quiz.sid', secret: config.secret, store: sessionStore || new MysqlSessionStore(pool),
    resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.secure, maxAge: 8 * 60 * 60 * 1000 } }));
  app.locals.formatDate = date => date ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(date)) : '—';
  app.locals.scoreText = score => score === null || score === undefined ? '—' : Number(score).toFixed(2);
  app.locals.statusText = status => ({ in_progress: 'Đang làm', submitted: 'Đã nộp', expired: 'Hết giờ' }[status] || status);
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.locals.path = req.path;
    res.locals.flash = req.session.flash;
    delete req.session.flash;
    res.locals.user = null;
    res.locals.csrfToken = '';
    next();
  });
  app.use(csrf);
  app.use(loadUser(pool));
  app.get('/', (req, res) => res.redirect(req.user ? (req.user.role === 'admin' ? '/admin' : '/exams') : '/login'));
  app.use(authRoutes(pool));
  app.use('/admin', adminRoutes(pool));
  app.use(studentRoutes(pool));
  app.use((req, res) => res.status(404).render('error', { title: 'Không tìm thấy trang', status: 404, message: 'Trang bạn tìm kiếm không tồn tại.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    if (status >= 500) console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}: ${error.code || error.name}`);
    const message = status >= 500 ? 'Hệ thống tạm thời không xử lý được yêu cầu. Vui lòng thử lại hoặc kiểm tra kết nối cơ sở dữ liệu.' : error.message;
    if (req.is('application/json')) return res.status(status).json({ error: message });
    res.status(status).render('error', { user: null, csrfToken: '', path: req.path, flash: null, ...res.locals, title: 'Không thể xử lý yêu cầu', status, message });
  });
  return app;
}
module.exports = { createApp };
