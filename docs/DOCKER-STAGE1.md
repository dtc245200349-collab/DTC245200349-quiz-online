# Triển khai giai đoạn 1

## Điều kiện trên Windows

- Windows hỗ trợ Docker Desktop; bật virtualization.
- Cài WSL2 và Docker Desktop, bật Linux containers. Việc cài WSL có thể cần quyền quản trị và khởi động lại máy; dự án không tự thay đổi các tính năng hệ điều hành.
- Docker Compose từ 2.20.3 để dùng file tương thích `docker-compose.yml` có `include`; khuyến nghị bản Compose đi kèm Docker Desktop hiện tại.
- Node.js 22+ để chạy công cụ tạo cấu hình/kiểm thử ngoài container. Chrome hoặc Edge cho Playwright.

Tại thời điểm kiểm tra 24/10/2026, máy chưa có Docker Desktop/Engine, WSL báo chưa được cài. CLI Compose độc lập tải trong `.runtime/tools` chỉ hỗ trợ kiểm tra cấu hình; **không thay thế Docker Engine**.

Hướng dẫn chính thức: [Docker Desktop Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [WSL2 backend](https://docs.docker.com/desktop/features/wsl/).

## Khởi chạy

```powershell
npm.cmd ci
npm.cmd run setup:env
docker version
docker compose version
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --build --wait --wait-timeout 240
docker compose -f compose.yaml exec app node scripts/seed.js
docker compose -f compose.yaml ps
```

Script tạo `.env` chỉ sinh mới nếu file chưa tồn tại. Đặt `NGINX_PORT=8080`, `PHPMYADMIN_PORT=8081` nếu muốn ghi rõ; Compose có mặc định này nên không cần ghi đè `.env` cũ. Không chụp/chia sẻ kết quả `config` đầy đủ vì nó chứa secret nội suy.

| Thành phần | Truy cập |
|---|---|
| Quiz qua Nginx | http://localhost:8080 |
| phpMyAdmin | http://localhost:8081 |
| Express | `app:3000`, chỉ trong backend |
| MySQL | `db:3306`, chỉ trong backend |
| Prometheus/Grafana/Loki | Chưa triển khai; thuộc mốc tiếp theo |

Đăng nhập website bằng tài khoản seed trong `.runtime/demo-accounts.txt` hoặc các biến `SEED_*` trong `.env`. phpMyAdmin dùng **DB_USER/DB_PASSWORD**, không dùng tài khoản website. Root login qua phpMyAdmin bị tắt.

## Dữ liệu và quyền MySQL

Compose dùng project `dtc245200349-quiz-online`, volume `mysql_data`. Đây là dữ liệu riêng, không tự nhập hoặc thay đổi database Windows ở 3306/3317. Không dùng tên project/volume này cho hệ thống khác. Nếu đã từng chạy một cấu hình cũ ở tên project khác, volume cũ vẫn được giữ nguyên.

Khi volume trống, entrypoint MySQL chạy `database/schema.sql`, rồi `deploy/mysql/20-app-permissions.sh`. Root chỉ dùng để khởi tạo. User ứng dụng được cấp `SELECT, INSERT, UPDATE, DELETE` trên đúng database, không CREATE/DROP/ALTER hoặc GRANT. Express không nhận root password, không thực hiện DDL khi khởi động.

Với volume đã tồn tại, script khởi tạo không tự chạy lại. Đừng xóa volume để sửa lỗi. Kiểm tra backup và lập migration được duyệt nếu cần cập nhật schema/quyền. `npm run db:init` dành cho quy trình local có user quyền DDL, không chạy bằng user DML trong container.

## Nginx và mạng

Browser → `127.0.0.1:8080` → Nginx → `app:3000` → `db:3306`. phpMyAdmin ở `127.0.0.1:8081` nối MySQL qua backend. Mạng backend đặt `internal: true`; Nginx/phpMyAdmin có mạng giao diện riêng. Không mount Docker socket.

Express tin một proxy; Nginx ghi đè `X-Forwarded-For` bằng IP kết nối, không chuyển tiếp chuỗi do client tự khai báo. Nginx đặt X-Content-Type-Options, X-Frame-Options, Referrer-Policy và Permissions-Policy trên cả lỗi; Helmet vẫn cung cấp CSP của ứng dụng. Không bật HSTS/Secure cookie khi chạy localhost HTTP; chỉ bật khi có HTTPS thực sự.

Access log Nginx chỉ ghi thời gian, method, nhóm route, status và duration; không ghi query string, body, cookie hoặc Authorization. Thu gom log và kiểm thử chống rò rỉ toàn bộ log sẽ thực hiện ở giai đoạn 3.

Tham chiếu: [Compose networking](https://docs.docker.com/compose/how-tos/networking/), [Nginx headers](https://nginx.org/en/docs/http/ngx_http_headers_module.html), [Nginx proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html), [phpMyAdmin image](https://hub.docker.com/_/phpmyadmin).

## Kiểm thử nghiệm thu

```powershell
npm.cmd run check:compose
npm.cmd run test:deployment
curl.exe -I http://localhost:8080/login
curl.exe http://localhost:8080/health
docker compose -f compose.yaml exec nginx nginx -t
docker compose -f compose.yaml exec app id
docker network inspect dtc245200349-quiz-online_backend --format '{{.Internal}}'
docker compose -f compose.yaml port app 3000
docker compose -f compose.yaml port db 3306
```

Hai lệnh `port` cuối không được trả mapping cổng host. Kiểm thử deployment phải chạy trên Docker thật; nó tạo câu hỏi/đề và sinh viên QA mới rồi giữ lại, không xóa dữ liệu. Kiểm tra đăng nhập admin, tạo đề, đăng ký sinh viên, tự lưu, nộp, điểm server, truy vấn MySQL và xem bài qua phpMyAdmin. Bằng chứng lưu ở `reports/evidence`, được Git ignore.

Nếu dùng Edge: `$env:BROWSER_CHANNEL = 'msedge'`. Nếu test phpMyAdmin thất bại do giao diện khác phiên bản, kiểm tra lỗi và xác minh bằng trình duyệt; không tự gán PASS.

## Khắc phục

- Không có pipe `docker_engine`: Docker Engine chưa chạy hoặc chưa được cài; CLI Compose đơn lẻ không đủ.
- Cổng 8080/8081 bận: đổi NGINX_PORT/PHPMYADMIN_PORT trong `.env`, chạy lại Compose; không dừng tiến trình không thuộc dự án.
- MySQL unhealthy: xem log cục bộ, kiểm tra volume, mật khẩu và script init. Không paste secrets hoặc xóa volume để thử lại.
- App `ER_TABLEACCESS_DENIED_ERROR` ở DDL: app cố chạy script khởi tạo bằng user DML. Giữ command Node server; schema thuộc entrypoint MySQL.
- 502: kiểm tra app health; Nginx dùng Docker DNS để cập nhật IP app khi container được tạo lại.
- Đăng nhập lặp trên HTTP: đặt COOKIE_SECURE=false. Nếu HTTPS đặt true và cấu hình reverse proxy phù hợp.

Chỉ xin phép commit 1 khi các bước runtime trên đã PASS: `feat: deploy quiz app mysql and nginx reverse proxy`.
