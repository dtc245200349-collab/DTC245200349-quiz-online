require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { compose } = require('./compose-command');

function verify() {
  const result = compose(['config', '--format', 'json']);
  if (result.status !== 0) throw new Error('Compose config không hợp lệ. Chạy docker compose -f compose.yaml config --quiet để kiểm tra; không chia sẻ bản config đã nội suy secrets.');
  // Resolved config contains secrets: keep it in memory, never print or save it.
  const config = JSON.parse(result.stdout);
  const s = config.services;
  for (const name of ['app','db','nginx','phpmyadmin']) assert.ok(s[name], `Thiếu service ${name}`);
  assert.equal(config.name, 'dtc245200349-quiz-online');
  assert.equal(config.networks.backend.internal, true);
  for (const name of ['db','app']) {
    assert.ok(!s[name].ports?.length, `${name} không được publish cổng`);
    assert.deepEqual(Object.keys(s[name].networks), ['backend']);
  }
  for (const [name, target] of [['nginx',8080],['phpmyadmin',80]]) {
    assert.equal(s[name].ports.length,1);
    assert.equal(s[name].ports[0].host_ip,'127.0.0.1');
    assert.equal(s[name].ports[0].target,target);
    assert.ok(Object.hasOwn(s[name].networks,'backend'));
  }
  assert.notEqual(s.nginx.ports[0].published, s.phpmyadmin.ports[0].published);
  assert.equal(s.app.environment.TRUST_PROXY, '1');
  assert.ok(!('MYSQL_ROOT_PASSWORD' in s.app.environment));
  assert.ok(!s.app.env_file?.length);
  assert.equal(s.app.read_only,true);
  assert.ok(s.app.cap_drop.includes('ALL'));
  assert.ok(s.app.environment.SESSION_SECRET.length >= 32);
  assert.ok(s.db.environment.MYSQL_ROOT_PASSWORD.length >= 20);
  assert.ok(s.app.environment.DB_PASSWORD.length >= 20);
  assert.ok(/^[a-zA-Z0-9_]+$/.test(s.app.environment.DB_NAME));
  assert.ok(/^[a-zA-Z0-9_]+$/.test(s.app.environment.DB_USER));
  assert.notEqual(s.app.environment.DB_USER,'root');
  for (const name of ['app','db','nginx','phpmyadmin']) assert.ok(s[name].healthcheck.test.length);
  assert.equal(s.nginx.depends_on.app.condition,'service_healthy');
  assert.ok(!s.phpmyadmin.environment.PMA_PASSWORD);
  assert.ok(!s.phpmyadmin.environment.PMA_USER);
  console.log('PASS: Compose config, 4 services, localhost ports, internal backend, healthchecks, secrets isolation and app restrictions.');
  console.log('Đây là kiểm tra cấu hình; chưa chứng minh container chạy hoặc ứng dụng đi qua Nginx.');
}
if (require.main === module) { try { verify(); } catch (error) { console.error(error.message); process.exitCode=1; } }
module.exports = { verify };
