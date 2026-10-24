# Checklist ảnh minh chứng — Đề 35

Chỉ chụp sau khi dịch vụ thật chạy thành công. Không tạo ảnh mô phỏng hoặc ghi số liệu chưa đo. Mặc định ảnh trong thư mục này bị `.gitignore` loại trừ để tránh đưa thông tin nhạy cảm lên GitHub. Kiểm tra nội dung trước khi quyết định đưa ảnh cụ thể vào commit.

## Giai đoạn 1

- [ ] `01-compose-healthy.png`: `docker compose -f compose.yaml ps` có app, db, nginx, phpmyadmin healthy.
- [ ] `02-login-nginx.png`: trình duyệt ở `http://localhost:8080/login` (thanh địa chỉ thể hiện Nginx).
- [ ] `03-admin-exam.png`: admin tạo đề, thấy đề trong danh sách.
- [ ] `04-student-attempt.png`: đồng hồ và đáp án đã lưu.
- [ ] `05-result-history.png`: điểm và lịch sử bài vừa thi.
- [ ] `06-phpmyadmin-result.png`: truy vấn `attempts`/`answers` hiển thị bài tương ứng; không chụp bảng users/password_hash hoặc bảng sessions.
- [ ] `07-nginx-headers.png`: `curl.exe -I http://localhost:8080/login` có các security headers.
- [ ] `08-private-ports.png`: app/db không publish cổng; network backend Internal=true.
- [ ] `09-non-root.png`: `docker compose -f compose.yaml exec app id` cho UID khác 0.

`npm.cmd run test:deployment` tự lưu ảnh trình duyệt thật nếu đi qua các bước thành công; xem `reports/evidence/stage1-*/checks.json` và các ảnh trong cùng thư mục. Khi Docker chưa chạy, chỉ có báo cáo BLOCKED, không có ảnh thành công.

## Giai đoạn 2 — chưa triển khai

- [ ] Prometheus targets bắt buộc đều UP.
- [ ] Grafana container CPU/RAM hoặc metrics hợp lệ tương đương, có nhãn container và thời gian.
- [ ] Grafana request/status/latency của web.
- [ ] Grafana MySQL up/connections/query metrics.
- [ ] Ảnh chẩn đoán cAdvisor/WSL2 nếu xảy ra giới hạn môi trường.

## Giai đoạn 3 — chưa triển khai

- [ ] Loki datasource kết nối thành công.
- [ ] Promtail thu log thật; không chụp secrets.
- [ ] LogQL xem log app.
- [ ] LogQL lọc lỗi do tình huống kiểm thử tạo ra.
- [ ] LogQL HTTP/đăng nhập.
- [ ] Bằng chứng ít nhất 4 biện pháp hardening.
- [ ] `git log --oneline --reverse` có ba commit đúng thứ tự sau khi từng commit đã được duyệt.

## Trước khi chia sẻ

Che mật khẩu, cookie, CSRF token, session data, Authorization và thông tin cá nhân không cần thiết. Không chụp `docker inspect` toàn bộ Environment hoặc `docker compose config` đã nội suy secrets. Ưu tiên lệnh kiểm tra có trường giới hạn và `config --quiet`.
