// Creates a NEW database with a random name. Never drops a database or changes the configured app DB.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const mysql = require('mysql2/promise');
const { getConfig } = require('../src/config');
const { createPool } = require('../src/db');
const { createApp } = require('../src/app');
const { initialize } = require('../scripts/init-db');
const { seed } = require('../scripts/seed');
const { startAttempt, updateAttempt, expireAttempts } = require('../src/services/attempts');

let pool, app, config, admin, student, other, demo, database, adminToken, studentToken;
const csrfFrom = response => {
  const token = response.text.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  assert.ok(token, `Không có CSRF token, HTTP ${response.status}`); return token;
};
async function login(agent, email, password) {
  const token = csrfFrom(await agent.get('/login').expect(200));
  await agent.post('/login').type('form').send({ _csrf: token, email, password }).expect(302);
}
before(async () => {
  config = getConfig();
  if (!process.env.TEST_DB_USER || !process.env.TEST_DB_PASSWORD) throw new Error('Cần TEST_DB_USER / TEST_DB_PASSWORD có quyền CREATE DATABASE mới. Không dùng database ứng dụng cho test.');
  database = `quiz_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const dbConfig = { ...config.db, database, user: process.env.TEST_DB_USER, password: process.env.TEST_DB_PASSWORD };
  await initialize(dbConfig);
  pool = createPool(dbConfig);
  demo = { SEED_ADMIN_EMAIL:'admin@test.local', SEED_ADMIN_PASSWORD:'Admin-Test!654', SEED_STUDENT_EMAIL:'student@test.local', SEED_STUDENT_PASSWORD:'Student-Test!654' };
  await seed(pool, demo);
  app = createApp({ pool, config: { ...config, secure: false } });
  admin = request.agent(app); student = request.agent(app); other = request.agent(app);
  await login(admin, demo.SEED_ADMIN_EMAIL, demo.SEED_ADMIN_PASSWORD);
  await login(student, demo.SEED_STUDENT_EMAIL, demo.SEED_STUDENT_PASSWORD);
  adminToken = csrfFrom(await admin.get('/admin').expect(200));
  studentToken = csrfFrom(await student.get('/exams').expect(200));
});
after(async () => { if (pool) await pool.end(); console.log(`Database test được giữ lại, không xóa dữ liệu: ${database || '(chưa tạo)'}`); });

test('Đăng ký chỉ tạo student, email trùng bị từ chối và đăng nhập được', async () => {
  const token = csrfFrom(await other.get('/register').expect(200));
  const data = { _csrf: token, name:'Sinh viên kiểm thử', email:'other@test.local', password:'Other-Test!654', confirm_password:'Other-Test!654', role:'admin' };
  await other.post('/register').type('form').send(data).expect(302);
  const [[user]] = await pool.execute('SELECT * FROM users WHERE email = ?', [data.email]);
  assert.equal(user.role,'student'); assert.ok(user.password_hash.startsWith('$2'));
  await other.post('/register').type('form').send(data).expect(400);
  await login(other,data.email,data.password);
});
test('Bảo vệ route, CSRF và chống SQL Injection trên đăng nhập', async () => {
  await request(app).get('/admin').expect(302);
  await student.get('/admin').expect(403);
  await student.post('/exams/1/start').type('form').send({}).expect(403);
  await student.post('/exams/1/start').type('form').send({ _csrf:'ấ'.repeat(64) }).expect(403);
  const guest = request.agent(app), token = csrfFrom(await guest.get('/login'));
  await guest.post('/login').type('form').send({ _csrf:token,email:"' OR 1=1 --@test.local",password:'Anything!123' }).expect(400);
});
test('Toàn bộ trang quản trị và sinh viên render với dữ liệu MySQL', async () => {
  for (const url of ['/admin','/admin/students','/admin/questions','/admin/questions/new','/admin/questions/1/edit','/admin/exams','/admin/exams/new','/admin/exams/1/edit','/admin/results']) await admin.get(url).expect(200);
  for (const url of ['/exams','/exams/1','/history']) await student.get(url).expect(200);
  await request(app).get('/health').expect(200);
});
test('Bắt đầu đồng thời chỉ tạo một bài; không lộ đáp án, ngăn xem bài người khác', async () => {
  const [a,b] = await Promise.all([startAttempt(pool,2,1),startAttempt(pool,2,1)]);
  assert.equal(a,b);
  const response = await student.get(`/attempts/${a}`).expect(200);
  const [[answer]] = await pool.execute('SELECT * FROM answers WHERE attempt_id = ? ORDER BY position LIMIT 1',[a]);
  assert.ok(!response.text.includes(answer.explanation));
  assert.ok(!response.text.includes('correct_option'));
  await other.get(`/attempts/${a}`).expect(404);
  await other.get(`/attempts/${a}/result`).expect(404);
  const otherToken = csrfFrom(await other.get('/exams'));
  await other.post(`/attempts/${a}/submit`).type('form').send({ _csrf:otherToken }).expect(404);
});
test('Tự lưu, snapshot chống sửa đề, điểm server bỏ qua điểm giả, nộp lặp không đổi kết quả', async () => {
  const id = await startAttempt(pool,2,1);
  const [answers] = await pool.execute('SELECT * FROM answers WHERE attempt_id = ? ORDER BY position',[id]);
  const payload = Object.fromEntries(answers.map(a=>[a.id,a.correct_option]));
  await student.post(`/attempts/${id}/save`).set('X-CSRF-Token',studentToken).send({ answers:payload }).expect(200);
  await pool.execute("UPDATE questions SET content = 'Nội dung đã thay đổi', correct_option = 'D' WHERE id = ?",[answers[0].question_id]);
  const [[snapshot]] = await pool.execute('SELECT question_content FROM answers WHERE id = ?',[answers[0].id]);
  assert.equal(snapshot.question_content, answers[0].question_content);
  const formPayload = Object.fromEntries(Object.entries(payload).map(([id,value])=>[`a_${id}`,value]));
  await student.post(`/attempts/${id}/submit`).type('form').send({ _csrf:studentToken, answers:formPayload, score:999, correct_count:999 }).expect(302);
  const [[first]] = await pool.execute('SELECT * FROM attempts WHERE id = ?',[id]);
  assert.equal(first.score,10); assert.equal(first.correct_count,5);
  await student.post(`/attempts/${id}/submit`).type('form').send({ _csrf:studentToken,answers:{['a_'+answers[0].id]:'D'} }).expect(302);
  const [[second]] = await pool.execute('SELECT * FROM attempts WHERE id = ?',[id]);
  assert.equal(second.score,10);
  assert.equal(+second.submitted_at,+first.submitted_at);
  const result = await student.get(`/attempts/${id}/result`).expect(200);
  assert.ok(result.text.includes(answers[0].explanation));
  await admin.get(`/admin/results/${id}`).expect(200);
});
test('Hết giờ từ server: không nhận đáp án mới, chấm phần đã lưu', async () => {
  const id = await startAttempt(pool,2,2);
  const [answers] = await pool.execute('SELECT * FROM answers WHERE attempt_id = ? ORDER BY position',[id]);
  await updateAttempt(pool,id,2,{[answers[0].id]:answers[0].correct_option});
  await pool.execute('UPDATE attempts SET expires_at = TIMESTAMPADD(SECOND,-1,UTC_TIMESTAMP(3)) WHERE id = ?',[id]);
  const result = await updateAttempt(pool,id,2,Object.fromEntries(answers.map(a=>[a.id,a.correct_option])),true);
  assert.equal(result.status,'expired'); assert.equal(result.correct_count,1); assert.equal(result.score,1);
});
test('Worker chấm bài ngay cả khi trình duyệt đã đóng', async () => {
  const id = await startAttempt(pool,2,3);
  await pool.execute('UPDATE attempts SET expires_at = TIMESTAMPADD(SECOND,-1,UTC_TIMESTAMP(3)) WHERE id = ?',[id]);
  await expireAttempts(pool);
  const [[row]] = await pool.execute('SELECT status, score FROM attempts WHERE id = ?',[id]);
  assert.equal(row.status,'expired'); assert.equal(row.score,0);
});
test('CRUD câu hỏi/đề thi, tìm kiếm, chặn xóa câu đang dùng và bảo toàn kết quả', async () => {
  const q = { _csrf:adminToken, content:'Câu hỏi <script>alert(1)</script> kiểm thử', option_a:'A', option_b:'B', option_c:'C', option_d:'D', correct_option:'B', explanation:'Giải thích kiểm thử', category:'Integration' };
  await admin.post('/admin/questions/new').type('form').send(q).expect(302);
  const [[question]] = await pool.execute('SELECT id FROM questions WHERE category = ?',['Integration']);
  const search = await admin.get('/admin/questions?q=Integration').expect(200);
  assert.ok(search.text.includes('&lt;script&gt;')); assert.ok(!search.text.includes('<script>alert'));
  await admin.post(`/admin/questions/${question.id}/edit`).type('form').send({...q,content:'Câu hỏi đã chỉnh sửa thành công'}).expect(302);
  const exam = { _csrf:adminToken,title:'Đề kiểm thử CRUD',description:'Kiểm thử lưu trữ',duration_minutes:10,question_count:1,question_ids:[question.id],is_published:'1' };
  await admin.post('/admin/exams/new').type('form').send({...exam,question_count:2}).expect(400);
  await admin.post('/admin/exams/new').type('form').send(exam).expect(302);
  const [[created]] = await pool.execute('SELECT id FROM exams WHERE title = ?',[exam.title]);
  await admin.post(`/admin/questions/${question.id}/delete`).type('form').send({_csrf:adminToken}).expect(409);
  const attemptId = await startAttempt(pool,2,created.id);
  const [[answer]] = await pool.execute('SELECT * FROM answers WHERE attempt_id = ?',[attemptId]);
  await updateAttempt(pool,attemptId,2,{[answer.id]:'B'},true);
  await admin.post(`/admin/exams/${created.id}/edit`).type('form').send({...exam,title:'Đề đã đổi tên'}).expect(302);
  await admin.post(`/admin/exams/${created.id}/delete`).type('form').send({_csrf:adminToken}).expect(302);
  await student.get(`/exams/${created.id}`).expect(404);
  await admin.post(`/admin/questions/${question.id}/delete`).type('form').send({_csrf:adminToken}).expect(302);
  await student.get(`/attempts/${attemptId}/result`).expect(200);
});
test('Chặn câu trả lời không thuộc bài; hai lần nộp đồng thời cho cùng kết quả', async () => {
  const id = await startAttempt(pool,2,1);
  await assert.rejects(updateAttempt(pool,id,2,{'999999':'A'}),{status:400});
  const [answers] = await pool.execute('SELECT * FROM answers WHERE attempt_id = ?',[id]);
  const payload = Object.fromEntries(answers.map(a=>[a.id,a.correct_option]));
  const [a,b] = await Promise.all([updateAttempt(pool,id,2,payload,true),updateAttempt(pool,id,2,payload,true)]);
  assert.equal(a.score,10); assert.equal(b.score,10);
});
test('Phiên lưu trong MySQL tồn tại qua instance Express mới và logout vô hiệu cookie', async () => {
  const agent = request.agent(app);
  const token = csrfFrom(await agent.get('/login'));
  const loginResponse = await agent.post('/login').type('form').send({_csrf:token,email:demo.SEED_STUDENT_EMAIL,password:demo.SEED_STUDENT_PASSWORD});
  const cookie = loginResponse.headers['set-cookie'][0].split(';')[0];
  const secondApp = createApp({pool,config:{...config,secure:false}});
  await request(secondApp).get('/history').set('Cookie',cookie).expect(200);
  const logoutToken = csrfFrom(await agent.get('/history'));
  await agent.post('/logout').type('form').send({_csrf:logoutToken}).expect(302);
  await request(secondApp).get('/history').set('Cookie',cookie).expect(302);
});
test('Khóa sinh viên thu hồi quyền của session đang đăng nhập', async () => {
  await admin.post('/admin/students/2/update').type('form').send({_csrf:adminToken,name:'Nguyễn Minh Anh',email:demo.SEED_STUDENT_EMAIL,active:'0'}).expect(302);
  await student.get('/exams').expect(302);
  await student.post('/attempts/1/save').set('X-CSRF-Token',studentToken).send({answers:{}}).expect(401);
});
