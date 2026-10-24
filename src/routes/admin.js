const express = require('express');
const { requireRole, flash } = require('../middleware/security');
const v = require('../lib/validation');
const { transaction } = require('../db');

function adminRoutes(pool) {
  const router = express.Router();
  router.use(requireRole('admin'));
  router.get('/', async (req, res) => {
    const [[stats]] = await pool.execute(`SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
      (SELECT COUNT(*) FROM exams WHERE deleted_at IS NULL) AS exams,
      (SELECT COUNT(*) FROM attempts WHERE status <> 'in_progress') AS attempts,
      (SELECT ROUND(AVG(score),2) FROM attempts WHERE status <> 'in_progress') AS average,
      (SELECT COUNT(*) FROM questions WHERE deleted_at IS NULL) AS questions`);
    const [recent] = await pool.execute('SELECT a.*, u.name FROM attempts a JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 6');
    const [distribution] = await pool.execute(`SELECT
      COALESCE(SUM(score < 5),0) AS low, COALESCE(SUM(score >= 5 AND score < 7),0) AS medium,
      COALESCE(SUM(score >= 7 AND score < 9),0) AS good, COALESCE(SUM(score >= 9),0) AS excellent
      FROM attempts WHERE status <> 'in_progress'`);
    res.render('admin/dashboard', { title: 'Tổng quan', stats, recent, distribution: distribution[0] });
  });
  router.get('/students', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const [students] = await pool.execute(`SELECT u.id, u.name, u.email, u.active, u.created_at,
      COUNT(a.id) AS attempts, ROUND(AVG(a.score),2) AS average FROM users u
      LEFT JOIN attempts a ON a.user_id = u.id AND a.status <> 'in_progress'
      WHERE u.role = 'student' AND (u.name LIKE ? OR u.email LIKE ?)
      GROUP BY u.id ORDER BY u.id DESC LIMIT 200`, [`%${q}%`, `%${q}%`]);
    res.render('admin/students', { title: 'Quản lý sinh viên', students, q });
  });
  router.post('/students/:id/update', async (req, res) => {
    const id = v.integer(req.params.id), name = v.text(req.body.name, 'Họ tên', 2, 100), email = v.email(req.body.email);
    if (!['0','1'].includes(req.body.active)) throw new v.HttpError(400, 'Trạng thái tài khoản không hợp lệ.');
    try {
      const [result] = await pool.execute('UPDATE users SET name = ?, email = ?, active = ? WHERE id = ? AND role = \'student\'', [name, email, Number(req.body.active), id]);
      if (!result.affectedRows) throw new v.HttpError(404, 'Không tìm thấy sinh viên.');
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new v.HttpError(400, 'Email đã thuộc về tài khoản khác.');
      throw error;
    }
    flash(req, 'success', 'Đã cập nhật sinh viên.'); res.redirect('/admin/students');
  });
  router.get('/questions', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const page = v.integer(req.query.page || 1, 'Trang', 1, 100000);
    const args = [`%${q}%`, `%${q}%`];
    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM questions WHERE deleted_at IS NULL AND (content LIKE ? OR category LIKE ?)', args);
    const [questions] = await pool.query('SELECT * FROM questions WHERE deleted_at IS NULL AND (content LIKE ? OR category LIKE ?) ORDER BY id DESC LIMIT 15 OFFSET ?', [...args, (page - 1) * 15]);
    res.render('admin/questions', { title: 'Ngân hàng câu hỏi', questions, q, total, page });
  });
  router.get('/questions/new', (req, res) => res.render('admin/question-form', { title: 'Thêm câu hỏi', question: {}, error: null }));
  router.get('/questions/:id/edit', async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM questions WHERE id = ? AND deleted_at IS NULL', [v.integer(req.params.id)]);
    if (!rows[0]) throw new v.HttpError(404, 'Không tìm thấy câu hỏi.');
    res.render('admin/question-form', { title: 'Chỉnh sửa câu hỏi', question: rows[0], error: null });
  });
  async function saveQuestion(req, res, next) {
    const id = req.params.id ? v.integer(req.params.id) : null;
    try {
      const q = v.question(req.body), values = Object.values(q);
      if (id) {
        const [r] = await pool.execute('UPDATE questions SET content = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, explanation = ?, category = ? WHERE id = ? AND deleted_at IS NULL', [...values, id]);
        if (!r.affectedRows) throw new v.HttpError(404, 'Không tìm thấy câu hỏi.');
      } else await pool.execute('INSERT INTO questions (content, option_a, option_b, option_c, option_d, correct_option, explanation, category, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [...values, req.user.id]);
      flash(req, 'success', id ? 'Đã cập nhật câu hỏi. Bài thi đã bắt đầu được giữ nguyên.' : 'Đã thêm câu hỏi mới.');
      res.redirect('/admin/questions');
    } catch (error) {
      if (error.status === 400) return res.status(400).render('admin/question-form', { title: id ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi', question: { ...req.body, id }, error: error.message });
      next(error);
    }
  }
  router.post('/questions/new', saveQuestion);
  router.post('/questions/:id/edit', saveQuestion);
  router.post('/questions/:id/delete', async (req, res) => {
    const id = v.integer(req.params.id);
    await transaction(pool, async conn => {
      const [rows] = await conn.execute('SELECT id FROM questions WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id]);
      if (!rows.length) throw new v.HttpError(404, 'Không tìm thấy câu hỏi.');
      const [uses] = await conn.execute('SELECT e.id FROM exam_questions eq JOIN exams e ON e.id = eq.exam_id WHERE eq.question_id = ? AND e.deleted_at IS NULL LIMIT 1', [id]);
      if (uses.length) throw new v.HttpError(409, 'Câu hỏi đang thuộc một đề thi. Hãy gỡ khỏi đề hoặc lưu trữ đề trước khi xóa.');
      await conn.execute('UPDATE questions SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?', [id]);
    });
    flash(req, 'success', 'Đã xóa câu hỏi khỏi ngân hàng. Kết quả cũ vẫn được bảo toàn.'); res.redirect('/admin/questions');
  });
  router.get('/exams', async (req, res) => {
    const [exams] = await pool.execute('SELECT e.*, (SELECT COUNT(*) FROM attempts a WHERE a.exam_id = e.id) AS attempts FROM exams e WHERE e.deleted_at IS NULL ORDER BY e.id DESC');
    res.render('admin/exams', { title: 'Quản lý đề thi', exams });
  });
  async function examForm(req, res) {
    const id = req.params.id ? v.integer(req.params.id) : null;
    let exam = { duration_minutes: 15, question_count: 5 }, selected = [];
    if (id) {
      const [rows] = await pool.execute('SELECT * FROM exams WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!rows[0]) throw new v.HttpError(404, 'Không tìm thấy đề thi.');
      exam = rows[0];
      const [links] = await pool.execute('SELECT question_id FROM exam_questions WHERE exam_id = ? ORDER BY position', [id]);
      selected = links.map(row => row.question_id);
    }
    const [questions] = await pool.execute('SELECT id, content, category FROM questions WHERE deleted_at IS NULL ORDER BY id');
    res.render('admin/exam-form', { title: id ? 'Chỉnh sửa đề thi' : 'Tạo đề thi', exam, selected, questions, error: null });
  }
  router.get('/exams/new', examForm);
  router.get('/exams/:id/edit', examForm);
  async function saveExam(req, res, next) {
    const id = req.params.id ? v.integer(req.params.id) : null;
    try {
      const exam = v.exam(req.body);
      await transaction(pool, async conn => {
        if (id) {
          const [rows] = await conn.execute('SELECT id FROM exams WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [id]);
          if (!rows.length) throw new v.HttpError(404, 'Không tìm thấy đề thi.');
        }
        const placeholders = exam.ids.map(() => '?').join(',');
        const [valid] = await conn.execute(`SELECT id FROM questions WHERE id IN (${placeholders}) AND deleted_at IS NULL FOR UPDATE`, exam.ids);
        if (valid.length !== exam.ids.length) throw new v.HttpError(400, 'Có câu hỏi không còn trong ngân hàng.');
        const values = [exam.title, exam.description, exam.duration_minutes, exam.question_count, exam.is_published];
        let examId = id;
        if (id) {
          await conn.execute('UPDATE exams SET title = ?, description = ?, duration_minutes = ?, question_count = ?, is_published = ? WHERE id = ?', [...values, id]);
          await conn.execute('DELETE FROM exam_questions WHERE exam_id = ?', [id]);
        } else {
          const [r] = await conn.execute('INSERT INTO exams (title, description, duration_minutes, question_count, is_published, created_by) VALUES (?, ?, ?, ?, ?, ?)', [...values, req.user.id]);
          examId = r.insertId;
        }
        for (const [index, questionId] of exam.ids.entries()) await conn.execute('INSERT INTO exam_questions (exam_id, question_id, position) VALUES (?, ?, ?)', [examId, questionId, index + 1]);
      });
      flash(req, 'success', 'Đã lưu đề thi. Thay đổi áp dụng cho các lượt thi mới.'); res.redirect('/admin/exams');
    } catch (error) {
      if (error.status === 400) {
        const [questions] = await pool.execute('SELECT id, content, category FROM questions WHERE deleted_at IS NULL ORDER BY id');
        const raw = req.body.question_ids || [];
        return res.status(400).render('admin/exam-form', { title: id ? 'Chỉnh sửa đề thi' : 'Tạo đề thi', exam: { ...req.body, id, is_published: req.body.is_published === '1' }, selected: (Array.isArray(raw) ? raw : [raw]).map(Number), questions, error: error.message });
      }
      next(error);
    }
  }
  router.post('/exams/new', saveExam);
  router.post('/exams/:id/edit', saveExam);
  router.post('/exams/:id/delete', async (req, res) => {
    const [r] = await pool.execute('UPDATE exams SET deleted_at = UTC_TIMESTAMP(3), is_published = 0 WHERE id = ? AND deleted_at IS NULL', [v.integer(req.params.id)]);
    if (!r.affectedRows) throw new v.HttpError(404, 'Không tìm thấy đề thi.');
    flash(req, 'success', 'Đã lưu trữ đề thi. Lịch sử và bài đang làm được giữ nguyên.'); res.redirect('/admin/exams');
  });
  router.get('/results', async (req, res) => {
    const examId = req.query.exam_id ? v.integer(req.query.exam_id) : null;
    const studentId = req.query.student_id ? v.integer(req.query.student_id) : null;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const page = v.integer(req.query.page || 1, 'Trang', 1, 100000);
    const where = 'WHERE (? IS NULL OR a.exam_id = ?) AND (? IS NULL OR a.user_id = ?) AND (u.name LIKE ? OR u.email LIKE ?)';
    const args = [examId, examId, studentId, studentId, `%${q}%`, `%${q}%`];
    const [[stats]] = await pool.execute(`SELECT COUNT(*) AS total, COUNT(a.score) AS completed, ROUND(AVG(a.score),2) AS average, MAX(a.score) AS best, COALESCE(SUM(a.score >= 5),0) AS passed FROM attempts a JOIN users u ON u.id = a.user_id ${where}`, args);
    const [attempts] = await pool.query(`SELECT a.*, u.name, u.email FROM attempts a JOIN users u ON u.id = a.user_id ${where} ORDER BY a.id DESC LIMIT 20 OFFSET ?`, [...args, (page - 1) * 20]);
    const [exams] = await pool.execute('SELECT id, title FROM exams ORDER BY id DESC');
    res.render('admin/results', { title: 'Kết quả & thống kê', attempts, exams, stats, examId, studentId, q, page });
  });
  router.get('/results/:id', async (req, res) => {
    const [rows] = await pool.execute('SELECT a.*, u.name, u.email FROM attempts a JOIN users u ON u.id = a.user_id WHERE a.id = ?', [v.integer(req.params.id)]);
    if (!rows[0]) throw new v.HttpError(404, 'Không tìm thấy bài làm.');
    if (rows[0].status === 'in_progress') throw new v.HttpError(409, 'Sinh viên đang làm bài. Chỉ xem đáp án khi bài đã kết thúc.');
    const [answers] = await pool.execute('SELECT * FROM answers WHERE attempt_id = ? ORDER BY position', [rows[0].id]);
    res.render('student/result', { title: 'Chi tiết kết quả', attempt: rows[0], student: rows[0], answers });
  });
  return router;
}
module.exports = { adminRoutes };
