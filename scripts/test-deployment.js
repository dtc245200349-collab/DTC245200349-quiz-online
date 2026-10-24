// Real acceptance test for an already-running Docker stack, never a mock/fallback.
// Creates a uniquely named question, exam and student. Does not delete test data.
require('dotenv').config({quiet:true});
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compose } = require('./compose-command');

async function main() {
  const base = `http://127.0.0.1:${process.env.NGINX_PORT || 8080}`;
  const pma = `http://127.0.0.1:${process.env.PHPMYADMIN_PORT || 8081}`;
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const evidence = path.resolve(__dirname,'../reports/evidence',`stage1-${stamp}`);
  fs.mkdirSync(evidence,{recursive:true});
  const checks=[];
  let browser;
  let step='Docker Engine and service health';
  function passed(name,details) { checks.push({name,status:'PASS',details}); console.log('PASS: '+name); }
  function exec(service,args) {
    const result = compose(['exec','-T',service,...args]);
    assert.equal(result.status,0,`${service}: command failed (output withheld to protect secrets)`);
    return result.stdout;
  }
  try {
    const state = compose(['ps','--format','json']);
    if (state.status !== 0) throw new Error('Không kết nối được Docker Engine. Cài/bật Docker Desktop Linux containers; không dùng kết quả local thay cho Docker.');
    const output=state.stdout.trim();
    const services=output.startsWith('[')?JSON.parse(output):output.split(/\r?\n/).filter(Boolean).map(JSON.parse);
    for(const name of ['app','db','nginx','phpmyadmin']) {
      const s=services.find(s=>s.Service===name);
      assert.ok(s && s.State==='running' && s.Health==='healthy',`${name} chưa running/healthy`);
    }
    passed(step,'4 required services running/healthy');
    step='Node non-root and private ports';
    assert.notEqual(exec('app',['id','-u']).trim(),'0');
    for(const [name,port] of [['app','3000'],['db','3306']]) {
      const result=compose(['port',name,port]);
      assert.equal(result.stdout.trim(),'');
    }
    passed(step,'Node UID is nonzero; app:3000 and db:3306 have no published ports');
    step='Nginx syntax, health and security headers';
    exec('nginx',['nginx','-t']);
    for(const route of ['/health','/metrics','/.env']) {
      const response=await fetch(base+route,{signal:AbortSignal.timeout(10000)});
      assert.equal(response.status,route==='/health'?200:404);
      assert.equal(response.headers.get('x-content-type-options'),'nosniff');
      assert.equal(response.headers.get('x-frame-options'),'DENY');
      assert.equal(response.headers.get('referrer-policy'),'no-referrer');
      assert.ok(response.headers.get('permissions-policy').includes('camera=()'));
      assert.ok(!(response.headers.get('server')||'').includes('/'));
      if(route==='/health') assert.equal((await response.json()).database,'connected');
    }
    passed(step,'Health 200; restricted routes 404; headers present on both');
    step='Admin creates question and exam through Nginx';
    browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    context.setDefaultTimeout(20000);
    const page=await context.newPage();
    const browserErrors=[];
    page.on('pageerror',error=>browserErrors.push(error.message));
    await page.goto(base+'/login');
    await page.getByLabel('Địa chỉ email').fill(process.env.SEED_ADMIN_EMAIL);
    await page.getByLabel('Mật khẩu',{exact:true}).fill(process.env.SEED_ADMIN_PASSWORD);
    await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
    await page.waitForURL('**/admin');
    await page.screenshot({path:path.join(evidence,'01-admin-nginx.png'),fullPage:true});
    const marker='QA-'+crypto.randomBytes(6).toString('hex');
    const question=`${marker}: Docker volume giữ dữ liệu sau khi tạo lại container?`;
    await page.goto(base+'/admin/questions/new');
    await page.getByLabel('Nội dung câu hỏi').fill(question);
    for(const [letter,text] of [['a','Đúng'],['b','Sai'],['c','Chỉ lưu trong RAM'],['d','Không có tác dụng']]) await page.locator('#option_'+letter).fill(text);
    await page.getByLabel('Đáp án đúng').selectOption('A');
    await page.getByLabel('Chủ đề').fill(marker);
    await page.getByLabel('Giải thích đáp án').fill('Volume lưu dữ liệu độc lập với container.');
    await page.getByRole('button',{name:'Lưu câu hỏi'}).click();
    await page.waitForURL('**/admin/questions');
    await page.goto(base+'/admin/exams/new');
    await page.getByLabel('Tên đề thi').fill(marker+' nghiệm thu Nginx');
    await page.getByLabel('Thời gian (phút)').fill('2');
    await page.getByLabel('Số lượng câu hỏi').fill('1');
    await page.locator('.picker-row').filter({hasText:question}).locator('input').check();
    await page.getByLabel('Mở đề thi cho sinh viên').check();
    await page.getByRole('button',{name:'Lưu đề thi',exact:true}).click();
    await page.waitForURL('**/admin/exams');
    await page.getByText(marker+' nghiệm thu Nginx',{exact:true}).waitFor();
    passed(step,marker);
    step='Student registers, autosaves and receives server grade';
    const studentContext=await browser.newContext({viewport:{width:1440,height:1000}});
    studentContext.setDefaultTimeout(20000);
    const student=await studentContext.newPage();
    student.on('pageerror',error=>browserErrors.push(error.message));
    const email=marker.toLowerCase()+'@qa.local';
    const password=crypto.randomBytes(20).toString('base64url');
    await student.goto(base+'/register');
    await student.getByLabel('Họ và tên').fill('Sinh viên '+marker);
    await student.getByLabel('Địa chỉ email').fill(email);
    await student.getByLabel('Mật khẩu',{exact:true}).fill(password);
    await student.getByLabel('Xác nhận mật khẩu').fill(password);
    await student.getByRole('button',{name:'Tạo tài khoản'}).click();
    await student.waitForURL('**/login');
    await student.getByLabel('Địa chỉ email').fill(email);
    await student.getByLabel('Mật khẩu',{exact:true}).fill(password);
    await student.getByRole('button',{name:'Đăng nhập',exact:true}).click();
    await student.waitForURL('**/exams');
    await student.getByRole('link',{name:marker+' nghiệm thu Nginx',exact:true}).click();
    await student.getByRole('button',{name:'Bắt đầu làm bài'}).click();
    await student.waitForURL(/\/attempts\/\d+$/);
    const attemptId=Number(student.url().split('/').pop());
    assert.ok(!(await student.content()).includes('correct_option'));
    await student.locator('input[type=radio][value=A]').check();
    await student.getByText('Đã lưu tất cả đáp án.',{exact:true}).waitFor();
    await student.reload();
    assert.equal(await student.locator('input[type=radio]:checked').count(),1);
    student.once('dialog',dialog=>dialog.accept());
    await student.getByRole('button',{name:'Nộp bài',exact:true}).click();
    await student.waitForURL('**/result');
    assert.equal(await student.locator('.result-score strong').textContent(),'10.00');
    await student.screenshot({path:path.join(evidence,'02-result-nginx.png'),fullPage:true});
    passed(step,`Attempt ${attemptId}; score 10.00 from server`);
    step='MySQL result persistence and least-privilege grants';
    // Only numeric ID enters the read-only diagnostic; no credentials appear in argv.
    const code=`const {getConfig}=require('./src/config');const {createPool}=require('./src/db');(async()=>{const p=createPool(getConfig().db);try{const [r]=await p.execute('SELECT id,status,score,correct_count FROM attempts WHERE id=?',[${attemptId}]);const [g]=await p.query('SHOW GRANTS FOR CURRENT_USER');console.log(JSON.stringify({result:r,grants:g.map(x=>Object.values(x)[0])}));}finally{await p.end();}})().catch(()=>process.exit(1));`;
    const record=JSON.parse(exec('app',['node','-e',code]));
    assert.equal(record.result[0].score,10);
    assert.ok(record.grants.some(g=>/SELECT, INSERT, UPDATE, DELETE/.test(g)));
    assert.ok(record.grants.every(g=>!/(ALL PRIVILEGES|GRANT OPTION|CREATE|DROP|ALTER)/.test(g)));
    passed(step,`Attempt ${attemptId} is persisted; application grants limited to DML`);
    step='phpMyAdmin authenticates and displays the saved attempt';
    const dbPage=await context.newPage();
    await dbPage.goto(pma);
    await dbPage.locator('#input_username').fill(process.env.DB_USER);
    await dbPage.locator('#input_password').fill(process.env.DB_PASSWORD);
    await dbPage.locator('#input_go').click();
    await dbPage.locator('#pma_navigation').waitFor();
    const query=`SELECT id, exam_title, status, correct_count, score FROM attempts WHERE id = ${attemptId}`;
    // Authenticated, read-only SQL view; screenshot excludes login/password fields.
    await dbPage.goto(pma+'/index.php?route=/table/sql&db='+encodeURIComponent(process.env.DB_NAME)+'&table=attempts');
    await dbPage.waitForFunction(()=>Boolean(document.querySelector('.CodeMirror')?.CodeMirror||document.querySelector('#sqlquery')));
    await dbPage.evaluate(sql=>{
      const cm=document.querySelector('.CodeMirror');
      if(cm?.CodeMirror) cm.CodeMirror.setValue(sql);
      else document.querySelector('#sqlquery').value=sql;
    },query);
    await dbPage.locator('#button_submit_query').click();
    await dbPage.getByText(marker+' nghiệm thu Nginx',{exact:true}).first().waitFor();
    await dbPage.screenshot({path:path.join(evidence,'03-phpmyadmin-result.png'),fullPage:true});
    passed(step,`Read-only query shows attempt ${attemptId}`);
    assert.deepEqual(browserErrors,[]);
  } catch(error) {
    checks.push({name:step,status:checks.length?'FAIL':'BLOCKED',details:error.message});
    console.error(`${checks.at(-1).status}: ${step}: ${error.message}`);
    process.exitCode=1;
  } finally {
    if(browser) await browser.close();
    fs.writeFileSync(path.join(evidence,'checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),base,checks},null,2));
    console.log('Evidence: '+path.relative(process.cwd(),evidence));
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
