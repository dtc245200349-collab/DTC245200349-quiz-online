const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const root = path.resolve(__dirname, '../src/views');
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
test('Tất cả EJS biên dịch thành công', () => {
  for (const filename of files(root)) assert.doesNotThrow(() => ejs.compile(fs.readFileSync(filename,'utf8'), { filename }), filename);
});
test('Trang đăng nhập escape dữ liệu người dùng', async () => {
  const html = await ejs.renderFile(path.join(root,'auth.ejs'), {
    title: 'Đăng nhập', user: null, csrfToken: 'test', path: '/login', flash: null,
    mode: 'login', error: null, values: { email: '<script>alert(1)</script>' }
  });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
