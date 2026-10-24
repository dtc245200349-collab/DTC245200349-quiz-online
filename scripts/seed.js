const bcrypt = require('bcrypt');
const { getConfig } = require('../src/config');
const { createPool, transaction } = require('../src/db');
const v = require('../src/lib/validation');
const samples = require('../database/sample-data');

async function seed(pool, env = process.env) {
  const adminEmail = v.email(env.SEED_ADMIN_EMAIL), studentEmail = v.email(env.SEED_STUDENT_EMAIL);
  if (adminEmail === studentEmail) throw new Error('Email quản trị và sinh viên phải khác nhau.');
  const adminHash = await bcrypt.hash(v.password(env.SEED_ADMIN_PASSWORD), 12);
  const studentHash = await bcrypt.hash(v.password(env.SEED_STUDENT_PASSWORD), 12);
  return transaction(pool, async conn => {
    const ids = [];
    for (const [name,email,hash,role] of [['Quản trị viên',adminEmail,adminHash,'admin'],['Nguyễn Minh Anh',studentEmail,studentHash,'student']]) {
      const [existing] = await conn.execute('SELECT id, role FROM users WHERE email = ?', [email]);
      if (existing.length) {
        if (existing[0].role !== role) throw new Error('Email seed đã có vai trò khác. Không tự động nâng quyền tài khoản hiện có.');
        ids.push(existing[0].id);
      } else {
        const [r] = await conn.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name,email,hash,role]);
        ids.push(r.insertId);
      }
    }
    const adminId = ids[0], questionIds = [];
    for (const [category,content,options,correct,explanation] of samples) {
      const [existing] = await conn.execute('SELECT id FROM questions WHERE content = ? AND deleted_at IS NULL LIMIT 1', [content]);
      if (existing.length) questionIds.push(existing[0].id);
      else {
        const [r] = await conn.execute('INSERT INTO questions (category, content, option_a, option_b, option_c, option_d, correct_option, explanation, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [category,content,...options,correct,explanation,adminId]);
        questionIds.push(r.insertId);
      }
    }
    const definitions = [
      ['Docker & triển khai ứng dụng', 'Củng cố kiến thức về image, container, volume và triển khai bằng Docker Compose.', 10, questionIds.slice(0,5)],
      ['MySQL & bảo mật hệ thống', 'Ôn tập dữ liệu quan hệ, transaction, xác thực và những nguyên tắc bảo mật cơ bản.', 15, questionIds.slice(5,15)],
      ['Triển khai & Quản trị Hệ thống Phần mềm', 'Đề ôn tập tổng hợp cuối học phần: Docker, cơ sở dữ liệu, bảo mật và vận hành ứng dụng.', 30, questionIds]
    ];
    for (const [title,description,duration,questions] of definitions) {
      const [existing] = await conn.execute('SELECT id FROM exams WHERE title = ? LIMIT 1', [title]);
      if (existing.length) continue;
      const [r] = await conn.execute('INSERT INTO exams (title,description,duration_minutes,question_count,is_published,created_by) VALUES (?,?,?,?,1,?)', [title,description,duration,questions.length,adminId]);
      for (const [index,id] of questions.entries()) await conn.execute('INSERT INTO exam_questions (exam_id,question_id,position) VALUES (?,?,?)', [r.insertId,id,index+1]);
    }
    return { adminId: ids[0], studentId: ids[1] };
  });
}
if (require.main === module) {
  const pool = createPool(getConfig().db);
  seed(pool).then(() => console.log('Seed hoàn tất: 2 tài khoản demo, 20 câu hỏi, 3 đề thi. Không đổi mật khẩu tài khoản đã tồn tại.'))
    .catch(error => { console.error('Seed thất bại:', error.message); process.exitCode = 1; }).finally(() => pool.end());
}
module.exports = { seed };
