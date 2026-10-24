const express = require('express');
const { requireRole } = require('../middleware/security');
const { integer, HttpError } = require('../lib/validation');
const { startAttempt, updateAttempt } = require('../services/attempts');

function studentRoutes(pool) {
  const router = express.Router();
  router.use(requireRole('student'));
  router.get('/exams', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const [exams] = await pool.execute('SELECT e.*, (SELECT id FROM attempts a WHERE a.exam_id = e.id AND a.user_id = ? AND a.status = \'in_progress\' LIMIT 1) AS active_attempt FROM exams e WHERE e.is_published = 1 AND e.deleted_at IS NULL AND e.title LIKE ? ORDER BY e.created_at DESC', [req.user.id, `%${q}%`]);
    const [[stats]] = await pool.execute('SELECT COUNT(*) AS completed, ROUND(AVG(score),2) AS average, MAX(score) AS best FROM attempts WHERE user_id = ? AND status <> \'in_progress\'', [req.user.id]);
    res.render('student/exams', { title: 'Đề thi của bạn', exams, stats, q });
  });
  router.get('/exams/:id', async (req, res) => {
    const id = integer(req.params.id);
    const [rows] = await pool.execute('SELECT * FROM exams WHERE id = ? AND is_published = 1 AND deleted_at IS NULL', [id]);
    if (!rows[0]) throw new HttpError(404, 'Không tìm thấy đề thi.');
    const [attempts] = await pool.execute('SELECT * FROM attempts WHERE user_id = ? AND exam_id = ? ORDER BY id DESC LIMIT 10', [req.user.id, id]);
    res.render('student/exam-detail', { title: rows[0].title, exam: rows[0], attempts });
  });
  router.post('/exams/:id/start', async (req, res) => {
    const id = await startAttempt(pool, req.user.id, integer(req.params.id));
    res.redirect(`/attempts/${id}`);
  });
  router.get('/history', async (req, res) => {
    const page = integer(req.query.page || 1, 'Trang', 1, 100000);
    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM attempts WHERE user_id = ?', [req.user.id]);
    const [attempts] = await pool.query('SELECT * FROM attempts WHERE user_id = ? ORDER BY id DESC LIMIT 20 OFFSET ?', [req.user.id, (page - 1) * 20]);
    res.render('student/history', { title: 'Lịch sử làm bài', attempts, page, total });
  });
  router.get('/attempts/:id', async (req, res) => {
    const id = integer(req.params.id);
    const attempt = await updateAttempt(pool, id, req.user.id, undefined);
    if (attempt.status !== 'in_progress') return res.redirect(`/attempts/${id}/result`);
    // Do not select correct_option or explanation while the attempt is active.
    const [answers] = await pool.execute('SELECT id, position, question_content, option_a, option_b, option_c, option_d, selected_option FROM answers WHERE attempt_id = ? ORDER BY position', [id]);
    const [[{ now }]] = await pool.execute('SELECT UTC_TIMESTAMP(3) AS now');
    res.render('student/take', { title: attempt.exam_title, attempt, answers, serverNow: now });
  });
  router.post('/attempts/:id/save', async (req, res) => {
    const id = integer(req.params.id);
    const attempt = await updateAttempt(pool, id, req.user.id, req.body.answers);
    res.json({ saved: attempt.status === 'in_progress', status: attempt.status, redirect: `/attempts/${id}/result` });
  });
  router.post('/attempts/:id/submit', async (req, res) => {
    const id = integer(req.params.id);
    await updateAttempt(pool, id, req.user.id, req.body.answers, true);
    res.redirect(`/attempts/${id}/result`);
  });
  router.get('/attempts/:id/result', async (req, res) => {
    const id = integer(req.params.id);
    const attempt = await updateAttempt(pool, id, req.user.id, undefined);
    if (attempt.status === 'in_progress') return res.redirect(`/attempts/${id}`);
    const [answers] = await pool.execute('SELECT * FROM answers WHERE attempt_id = ? ORDER BY position', [id]);
    res.render('student/result', { title: 'Kết quả bài thi', attempt, answers, student: req.user });
  });
  return router;
}
module.exports = { studentRoutes };
