const { transaction } = require('../db');
const { HttpError, selections } = require('../lib/validation');
const { grade } = require('../lib/grading');

async function finalize(conn, attempt, status, now) {
  const [answers] = await conn.execute('SELECT * FROM answers WHERE attempt_id = ? ORDER BY position', [attempt.id]);
  const result = grade(answers);
  await conn.execute('UPDATE answers SET is_correct = (COALESCE(selected_option, \'\') = correct_option) WHERE attempt_id = ?', [attempt.id]);
  await conn.execute('UPDATE attempts SET status = ?, submitted_at = ?, correct_count = ?, score = ? WHERE id = ?',
    [status, status === 'expired' ? attempt.expires_at : now, result.correctCount, result.score, attempt.id]);
  return { ...attempt, status, score: result.score, correct_count: result.correctCount };
}

async function startAttempt(pool, userId, examId) {
  return transaction(pool, async conn => {
    // Serialize starts per student, including double-clicks and concurrent tabs.
    await conn.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    const [existing] = await conn.execute('SELECT id FROM attempts WHERE user_id = ? AND exam_id = ? AND status = \'in_progress\'', [userId, examId]);
    if (existing.length) return existing[0].id;
    const [exams] = await conn.execute('SELECT * FROM exams WHERE id = ? AND is_published = 1 AND deleted_at IS NULL FOR UPDATE', [examId]);
    const exam = exams[0];
    if (!exam) throw new HttpError(404, 'Đề thi chưa được mở hoặc đã được lưu trữ.');
    const [questions] = await conn.execute('SELECT q.*, eq.position FROM exam_questions eq JOIN questions q ON q.id = eq.question_id WHERE eq.exam_id = ? ORDER BY eq.position', [examId]);
    if (questions.length !== exam.question_count) throw new HttpError(409, 'Số câu hỏi của đề thi chưa hợp lệ. Vui lòng liên hệ quản trị viên.');
    const [insert] = await conn.execute('INSERT INTO attempts (user_id, exam_id, exam_title, duration_minutes, total_questions, started_at, expires_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3), TIMESTAMPADD(MINUTE, ?, UTC_TIMESTAMP(3)))',
      [userId, examId, exam.title, exam.duration_minutes, questions.length, exam.duration_minutes]);
    for (const q of questions) await conn.execute('INSERT INTO answers (attempt_id, question_id, position, question_content, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [insert.insertId, q.id, q.position, q.content, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation]);
    return insert.insertId;
  });
}

async function updateAttempt(pool, attemptId, userId, input, submit = false) {
  return transaction(pool, async conn => {
    const [rows] = await conn.execute('SELECT * FROM attempts WHERE id = ? AND user_id = ? FOR UPDATE', [attemptId, userId]);
    const attempt = rows[0];
    if (!attempt) throw new HttpError(404, 'Không tìm thấy bài làm của bạn.');
    const [[{ now }]] = await conn.execute('SELECT UTC_TIMESTAMP(3) AS now');
    if (attempt.status !== 'in_progress') return attempt;
    // Reject any new answers after the server deadline. Previously saved answers count.
    if (now >= attempt.expires_at) return finalize(conn, attempt, 'expired', now);
    if (input !== undefined) {
      const [answers] = await conn.execute('SELECT id FROM answers WHERE attempt_id = ?', [attemptId]);
      const values = selections(input, new Set(answers.map(a => a.id)));
      for (const answer of values) await conn.execute('UPDATE answers SET selected_option = ? WHERE id = ? AND attempt_id = ?', [answer.option, answer.id, attemptId]);
    }
    return submit ? finalize(conn, attempt, 'submitted', now) : attempt;
  });
}

async function expireAttempts(pool) {
  const [rows] = await pool.execute('SELECT id, user_id FROM attempts WHERE status = \'in_progress\' AND expires_at <= UTC_TIMESTAMP(3) ORDER BY expires_at LIMIT 100');
  for (const row of rows) await updateAttempt(pool, row.id, row.user_id, undefined);
}
module.exports = { startAttempt, updateAttempt, expireAttempts };
