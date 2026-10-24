# Kế hoạch Đề 35 — DTC245200349

Repository đề xuất: **DTC245200349-quiz-online**. Không tạo remote hoặc push khi chưa có xác nhận của sinh viên.

## Mốc 1 — Website, database, phpMyAdmin, Nginx

- Kế thừa Express/EJS/MySQL, xác thực, phân quyền, ngân hàng câu hỏi, bài thi có snapshot, deadline và chấm điểm phía server.
- Dùng `compose.yaml`: MySQL, Express, Nginx, phpMyAdmin; volume dữ liệu; healthcheck; cổng 8080/8081 chỉ trên localhost.
- Không public 3000 hoặc 3306; tách mạng frontend và backend nội bộ. Node non-root; root password không đi vào container app.
- Kiểm tra unit, HTTP/MySQL và browser hiện có; kiểm tra triển khai thật qua Nginx và phpMyAdmin bằng `npm.cmd run test:deployment`.
- Ghi PASS/FAIL/BLOCKED; chỉ đề nghị commit khi đạt toàn bộ tiêu chí giai đoạn 1 và có bằng chứng runtime.

Commit cần xin phép: `feat: deploy quiz app mysql and nginx reverse proxy`.

## Mốc 2 — Prometheus, Grafana

- Kiểm tra Docker Desktop Linux/WSL2 trước khi chọn cấu hình cAdvisor; không giả lập container metrics.
- Thêm Prometheus, Grafana provisioning, cAdvisor hoặc giải pháp tương thích, nginx-prometheus-exporter, mysqld-exporter; có thể bổ sung prom-client.
- Endpoint metrics không ra cổng public; MySQL exporter dùng user chỉ đủ quyền giám sát.
- Dashboard có dữ liệu container, web server và database. Ghi lại targets UP, truy vấn thực và ảnh biểu đồ; xử lý thực tế các hạn chế Docker Desktop.

Commit cần xin phép: `feat: add prometheus grafana monitoring stack`.

## Mốc 3 — Loki, Promtail, hardening, báo cáo

- Kiểm tra tài liệu chính thức và ghim phiên bản Promtail phù hợp; ghi chú EOL và phạm vi thực hành theo yêu cầu giảng viên.
- Thu log Quiz/Nginx qua volume chỉ đọc; không dùng Docker socket nếu không cần.
- Loki datasource, ít nhất 3 LogQL queries, tạo request kiểm chứng log; kiểm tra không có mật khẩu/cookie/token.
- Chứng minh ít nhất 4 biện pháp hardening bằng kết quả lệnh, không chỉ mô tả cấu hình.
- Hoàn thiện README, backup/restore, báo cáo tiếng Việt tối thiểu 10 trang sau dàn Word và ảnh thật.

Commit cần xin phép: `feat: add loki promtail logging and security hardening`.

## Quy tắc ghi nhận

- Không tạo trước ba commit hoặc gộp cả ba giai đoạn rồi chia commit giả tạo.
- Mỗi giai đoạn có thay đổi, kiểm thử, báo cáo và phê duyệt commit riêng.
- Không thay đổi dữ liệu ứng dụng hiện có để tạo kết quả kiểm thử; test tạo database hoặc bản ghi QA riêng, không tự xóa.
- File `.env`, backup SQL, ảnh chưa kiểm tra và log raw bị Git ignore. Chỉ đưa minh chứng đã rà soát bí mật lên repository sau khi người dùng quyết định.
- Báo cáo ngày 09/10/2026 là kết quả phiên trước, không thay thế bằng chứng cho Docker của đợt 24/10/2026.
