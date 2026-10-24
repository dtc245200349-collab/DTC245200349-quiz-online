# Báo cáo giai đoạn 1 — Đề 35 — DTC245200349

Ngày: **24/10/2026**, múi giờ Asia/Bangkok. Trạng thái tổng thể: **CHƯA ĐỦ ĐIỀU KIỆN NGHIỆM THU/COMMIT 1** vì thiếu Docker Engine.

## Môi trường đã quan sát

- Windows, Node.js 24.19.0, npm 11.17.0, Git 2.55.0.windows.5.
- MySQL80 có sẵn ở 3306; không sửa dữ liệu hoặc dừng dịch vụ này.
- Khởi động lại MySQL riêng của dự án tại 3317 để tạo database QA riêng.
- Không tìm thấy Docker trong PATH/các vị trí cài đặt phổ biến; không có pipe `docker_engine`. `wsl --list --verbose` báo Windows Subsystem for Linux chưa được cài.
- Đã tải **Docker Compose CLI v2.39.4** chính thức vào `.runtime/tools`, đối chiếu SHA256 khớp checksum từ cùng release. CLI này chỉ giúp parse/check config; không cung cấp Engine.
- Git được khởi tạo với nhánh `main`; chưa có commit, remote hoặc push.

## PASS

| Lệnh / nội dung | Kết quả thực tế |
|---|---|
| Compose `-f compose.yaml config --quiet` | Exit code 0 |
| Compose `-f docker-compose.yml config --quiet` | Exit code 0, file tương thích hoạt động |
| `npm.cmd run check:compose` | PASS kiểm tra 4 service, port localhost, app/db không publish, backend internal, healthcheck, cấu hình user/secrets |
| `npm.cmd test` | **9/9 PASS** gồm kiểm thử session Secure qua proxy, HttpOnly/SameSite và Helmet |
| `node scripts/run-integration.js` | **11/11 PASS** với MySQL thật trên database QA mới |
| `node scripts/run-integration.js --browser` | PASS Chrome: đăng nhập, tự lưu, reload, nộp/chấm 10/10, admin tạo đề, mobile 390px, hết giờ |
| `npm.cmd run check` | **31 file JavaScript** qua kiểm tra cú pháp |
| Git Bash `-n deploy/mysql/20-app-permissions.sh` | PASS cú pháp shell; chưa thực thi SQL trong image |
| `node scripts/check-secrets.js` | Không phát hiện giá trị secret từ `.env` trong file Git candidate; các đường dẫn nhạy cảm được ignore |

Lần rà cuối bao gồm **74 file** nguồn/cấu hình/tài liệu. Đây là các file chuẩn bị đưa vào Git, chưa được stage hoặc commit.

Database QA tích hợp: `quiz_test_1792821621684_094b29`.

Database QA Chrome: `quiz_browser_1792821743625_6c3234`.

Các database QA được giữ lại, không DROP hoặc dùng database ứng dụng để reset dữ liệu. Ảnh Chrome local ở `.runtime/screenshots`; **không dùng các ảnh này để chứng minh Docker hoặc Nginx**.

## BLOCKED — chưa được tính PASS

`npm.cmd run test:deployment` đã chạy. Kết quả bước đầu: **BLOCKED: Docker Engine and service health** — không kết nối được Docker Engine.

Bằng chứng tự động: `reports/evidence/stage1-2026-10-24T06-00-30-474Z/checks.json` (bị Git ignore).

Do đó các nội dung sau chưa được kiểm chứng runtime:

1. Build image và 4 container cùng chạy healthy trên Docker Desktop.
2. `nginx -t` bên trong image, website qua localhost:8080 và security headers do Nginx phát ra.
3. Đăng nhập, tạo đề và thi qua Nginx trong Docker (đã PASS riêng ở local Express/MySQL).
4. phpMyAdmin đăng nhập và hiển thị kết quả thật.
5. MySQL 8.4 entrypoint chạy schema/script phân quyền; app chỉ có DML trong container.
6. UID non-root, filesystem chỉ đọc và network isolation thực tế trong Docker.
7. Restart container giữ dữ liệu; backup/restore Docker.

Không có lỗi ứng dụng còn tái hiện trong các bộ test đã chạy. Đây **không đồng nghĩa** giai đoạn Docker đã hoàn thành.

## Phân biệt cấu hình và bằng chứng hardening

| Biện pháp | Đã có trong mã/cấu hình | Bằng chứng hiện có |
|---|---|---|
| Node non-root | `USER node` trong Dockerfile | Chưa đo UID trong container |
| Network isolation | backend internal, không publish app/db | Compose model PASS; runtime chưa kiểm tra |
| Secrets ngoài Git | `.env`/runtime/backup/evidence ignored, app không nhận root password | Rà Git candidate và compose model PASS; không thay thế secret scanner tổng quát |
| Nginx headers | 4 headers với `always` | Chưa kiểm tra HTTP qua Nginx |
| Quyền DB tối thiểu | Init script cấp SELECT/INSERT/UPDATE/DELETE | Chưa thực thi trong image MySQL 8.4 |
| Session/Helmet/validation/RBAC | Backend có sẵn, thêm proxy tests | 9 unit/proxy + 11 MySQL integration PASS |

## Lỗi trong quá trình chuẩn bị đã sửa

Script kiểm tra cấu hình ban đầu coi giá trị `networks.backend` là truthy; Compose chuẩn hóa network không có option thành `null`. Đã sửa kiểm tra sự tồn tại của key, chạy lại và PASS. Không thay đổi isolation để vượt kiểm tra.

## Điều kiện tiếp tục

1. Cài/bật WSL2 và Docker Desktop Linux containers, xác nhận `docker version` có mục Server.
2. Chạy lệnh build/start/seed trong README.
3. Chạy lại `npm.cmd run test:deployment`; kiểm tra các ảnh/log/bằng chứng thực tế.
4. Chỉ khi đạt tiêu chí giai đoạn 1 mới xin phép commit: `feat: deploy quiz app mysql and nginx reverse proxy`.
5. Sau commit 1 được duyệt mới tiếp tục giai đoạn 2, rồi giai đoạn 3. Báo cáo tối thiểu 10 trang chưa được tuyên bố hoàn tất.
