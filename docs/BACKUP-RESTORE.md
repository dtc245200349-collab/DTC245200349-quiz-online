# Backup và restore dữ liệu

Các bước dưới đây dành cho Docker đã chạy thành công. **Chưa kiểm chứng runtime tại máy này vì thiếu Docker Engine.** Không cần xóa dữ liệu hiện tại để thử restore.

## Backup an toàn trên PowerShell

Tạo thư mục `backups` (đã được Git ignore). Dùng Node stream dữ liệu nhị phân để tránh PowerShell cũ chuyển SQL sang UTF-16. Script này chạy `mysqldump` trong container db, nhận mật khẩu từ môi trường container, không đưa mật khẩu vào command line hoặc log:

```powershell
node scripts/backup-db.js
```

Backup chứa dữ liệu tài khoản (hash mật khẩu), bài thi và session. Không đưa lên GitHub hoặc gửi công khai. Lưu một bản ở nơi có kiểm soát quyền truy cập; thư mục trên cùng ổ đĩa chỉ là bản sao làm việc, không thay thế backup ngoài máy.

## Restore vào database mới trước khi đụng dữ liệu thật

Chỉ sử dụng file dump do chính script backup của dự án tạo. Quy trình khôi phục gồm:

1. Đối chiếu SHA256 của file backup với file `.sha256` đi kèm.
2. Chuẩn bị môi trường MySQL thử nghiệm riêng hoặc database mới tên `quiz_restore_YYYYMMDD_HHMMSS`. Không dùng database ứng dụng đang chạy.
3. Tài khoản quản trị tạo database rỗng qua MySQL CLI trong container. Không dùng user DML của ứng dụng hoặc phpMyAdmin để cấp quyền.
4. Import file dump bằng MySQL CLI hoặc MySQL Workbench vào database mới, chọn UTF-8. Không chạy dump từ nguồn không tin cậy.
5. Kiểm tra đủ bảng, đếm rows, kiểm tra khóa ngoại và đối chiếu một vài kết quả `attempts`/`answers`.
6. Cấp quyền SELECT/INSERT/UPDATE/DELETE riêng cho ứng dụng thử nghiệm, cấu hình kết nối đến database restore và kiểm tra đăng nhập/thi/lịch sử.
7. Chỉ chuyển ứng dụng thật sang dữ liệu phục hồi sau khi người dùng phê duyệt kế hoạch chuyển đổi. Không tự ghi đè database hiện tại.

Ví dụ SQL để người có quyền quản trị chạy **trong môi trường restore mới**:

```sql
CREATE DATABASE quiz_restore_20261024 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Chọn schema quiz_restore_20261024 trong công cụ import, rồi nhập file dump.
SELECT COUNT(*) FROM quiz_restore_20261024.users;
SELECT COUNT(*) FROM quiz_restore_20261024.attempts;
SELECT id, exam_title, status, score
FROM quiz_restore_20261024.attempts ORDER BY id DESC LIMIT 5;
```

Dump không dùng `--databases`, nên không có lệnh chọn database nguồn. Không sử dụng `docker compose down -v`, `volume rm`, `DROP DATABASE` hoặc copy datadir đang chạy để thay cho quy trình backup/restore.

## Bằng chứng cần bổ sung khi Docker sẵn sàng

- Tên file, thời gian tạo, SHA256, dung lượng backup; không đưa nội dung dump vào log.
- Môi trường/database restore mới; số rows trước/sau, kết quả kiểm thử ứng dụng.
- Ghi rõ backup/restore PASS chỉ sau khi import và kiểm chứng dữ liệu thật.
