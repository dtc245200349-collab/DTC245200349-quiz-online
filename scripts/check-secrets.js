const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const root = path.resolve(__dirname,'..');
const git = args => spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});
const listed=git(['ls-files','--cached','--others','--exclude-standard','-z']);
if(listed.status!==0) { console.error('Cần khởi tạo Git trước khi kiểm tra các file sẽ đưa vào repository.'); process.exit(1); }
const files=[...new Set(listed.stdout.split('\0').filter(Boolean))];
const envPath=path.join(root,'.env');
const values=fs.existsSync(envPath)?Object.entries(dotenv.parse(fs.readFileSync(envPath)))
  .filter(([key,value])=>/PASSWORD|SECRET|TOKEN/.test(key)&&value.length>=8).map(([,value])=>value):[];
const violations=[];
for(const file of files) {
  if(file==='.env'||file.startsWith('.runtime/')||file.startsWith('backups/')||file.startsWith('reports/evidence/')) { violations.push(file); continue; }
  const target=path.join(root,file);
  if(!fs.existsSync(target)||!fs.statSync(target).isFile()) continue;
  const data=fs.readFileSync(target);
  if(values.some(value=>data.includes(Buffer.from(value)))) violations.push(file);
}
for(const target of ['.env','.runtime/demo-accounts.txt','backups/check.sql','reports/evidence/check.json']) {
  if(git(['check-ignore','--no-index','-q',target]).status!==0) violations.push('not-ignored: '+target);
}
if(violations.length) { console.error('FAIL: file chứa secret hoặc chưa ignore (không in giá trị):\n'+violations.join('\n')); process.exitCode=1; }
else console.log(`PASS: ${files.length} Git candidate files; no current .env secrets detected; sensitive paths ignored. Đây không thay thế secret scanner đầy đủ.`);
