const { test } = require('node:test');
const assert = require('node:assert/strict');
const { grade } = require('../src/lib/grading');
const v = require('../src/lib/validation');
const { getConfig } = require('../src/config');

test('Chấm điểm thang 10, bỏ trống và làm tròn hai chữ số', () => {
  assert.deepEqual(grade([{ correct_option: 'A', selected_option: 'A' },{ correct_option: 'B', selected_option: null },{ correct_option: 'C', selected_option: 'D' }]), { correctCount: 1, total: 3, score: 3.33 });
  assert.equal(grade([{ correct_option: 'D', selected_option: 'D' }]).score, 10);
  assert.throws(() => grade([]));
});
test('Không cho phép client gửi câu trả lời của bài khác hoặc phương án sai', () => {
  assert.deepEqual(v.selections({ 9: 'B' }, new Set([9])), [{ id: 9, option: 'B' }]);
  assert.deepEqual(v.selections({ a_9: 'B' }, new Set([9])), [{ id: 9, option: 'B' }]);
  assert.throws(() => v.selections({ 10: 'B' }, new Set([9])), { status: 400 });
  assert.throws(() => v.selections({ 9: 'E' }, new Set([9])), { status: 400 });
  assert.throws(() => v.selections(['A'], new Set([9])), { status: 400 });
});
test('Kiểm tra số câu được chọn và không chấp nhận mã trùng', () => {
  const body = { title: 'Đề thi hợp lệ', duration_minutes: '15', question_count: '2', question_ids: ['1','2'] };
  assert.equal(v.exam(body).question_count, 2);
  assert.throws(() => v.exam({ ...body, question_ids: ['1','1'] }), { status: 400 });
  assert.throws(() => v.exam({ ...body, duration_minutes: 0 }), { status: 400 });
});
test('Email, mật khẩu UTF-8 và số nguyên được kiểm tra phía server', () => {
  assert.equal(v.email(' Student@Example.com '), 'student@example.com');
  assert.throws(() => v.email('not an email'), { status: 400 });
  assert.throws(() => v.password('short'), { status: 400 });
  assert.throws(() => v.password('ấ'.repeat(25)), { status: 400 });
  assert.throws(() => v.integer('1 OR 1=1'), { status: 400 });
  assert.throws(() => v.integer('1.5'), { status: 400 });
});
test('Cấu hình không cho phép secret yếu hoặc tên database có SQL', () => {
  const env = { DB_HOST: 'localhost', DB_NAME: 'quiz', DB_USER: 'quiz', DB_PASSWORD: 'test-only', SESSION_SECRET: 'x'.repeat(32) };
  assert.equal(getConfig(env).port, 3000);
  assert.throws(() => getConfig({ ...env, SESSION_SECRET: 'weak' }));
  assert.throws(() => getConfig({ ...env, DB_NAME: 'x; DROP DATABASE y' }));
});
