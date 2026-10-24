const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) { console.log('.env đã tồn tại, không ghi đè.'); process.exit(0); }
const secret = () => crypto.randomBytes(24).toString('base64url');
const values = { DB_PASSWORD: secret(), MYSQL_ROOT_PASSWORD: secret(), SESSION_SECRET: secret() + secret(),
  SEED_ADMIN_PASSWORD: 'Adm!' + secret().slice(0,16), SEED_STUDENT_PASSWORD: 'Stu!' + secret().slice(0,16) };
let content = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
for (const [key, value] of Object.entries(values)) content = content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
if (process.argv.includes('--local-mysql')) content = content.replace('DB_PORT=3306', 'DB_PORT=3317');
fs.writeFileSync(envPath, content, { flag: 'wx', mode: 0o600 });
fs.mkdirSync(path.join(root, '.runtime'), { recursive: true });
fs.writeFileSync(path.join(root, '.runtime/demo-accounts.txt'),
  `TÀI KHOẢN DEMO CỤC BỘ — KHÔNG COMMIT / KHÔNG CHIA SẺ CÔNG KHAI\n\nQuản trị viên\nEmail: admin@quiz.local\nMật khẩu: ${values.SEED_ADMIN_PASSWORD}\n\nSinh viên\nEmail: student@quiz.local\nMật khẩu: ${values.SEED_STUDENT_PASSWORD}\n\nChạy npm.cmd run db:seed trước lần đăng nhập đầu tiên.\n`, { mode: 0o600 });
console.log('Đã tạo .env với khóa ngẫu nhiên và .runtime/demo-accounts.txt. Kiểm tra DB_HOST / DB_PORT trước khi khởi tạo.');
