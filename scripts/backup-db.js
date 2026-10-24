const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { composeCommand } = require('./compose-command');

async function main() {
  const root=path.resolve(__dirname,'..');
  const dir=path.join(root,'backups');
  fs.mkdirSync(dir,{recursive:true});
  const filename=path.join(dir,'quiz-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sql');
  const partial=filename+'.partial';
  const {binary,prefix}=composeCommand();
  const command='MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 -uroot "$MYSQL_DATABASE"';
  const child=spawn(binary,[...prefix,'-f',path.join(root,'compose.yaml'),'exec','-T','db','sh','-c',command],
    {cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  // Raw stderr may contain connection details; report only exit status to the user.
  child.stderr.resume();
  const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code));});
  const [code]=await Promise.all([exited,pipeline(child.stdout,fs.createWriteStream(partial,{flags:'wx',mode:0o600}))]);
  if(code!==0 || fs.statSync(partial).size===0) throw new Error('Backup thất bại; file .partial không phải bản sao lưu hợp lệ. Kiểm tra Docker Engine và container db.');
  fs.renameSync(partial,filename);
  const hash=crypto.createHash('sha256');
  for await(const chunk of fs.createReadStream(filename)) hash.update(chunk);
  fs.writeFileSync(filename+'.sha256',hash.digest('hex')+'  '+path.basename(filename)+'\n',{flag:'wx'});
  console.log('Backup completed: '+path.relative(root,filename));
  console.log('Cần restore thử vào database mới để kiểm chứng khả năng phục hồi.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
