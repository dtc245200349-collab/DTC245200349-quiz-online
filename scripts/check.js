const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let count = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
      if (result.status !== 0) { console.error(result.error?.message || result.stderr); process.exitCode = 1; }
      count++;
    }
  }
}
for (const folder of ['src','public/js','scripts','tests','database']) walk(path.join(root, folder));
console.log(`Đã kiểm tra cú pháp ${count} file JavaScript.`);
