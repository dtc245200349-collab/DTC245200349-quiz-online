# Kịch bản demo trước giảng viên (5–8 phút)

1. Mở `http://localhost:3000/health`, trình bày kết nối MySQL `connected`.
2. Đăng nhập quản trị bằng tài khoản trong `.runtime/demo-accounts.txt`. Xem dashboard và ngân hàng 20 câu hỏi thuộc Docker, MySQL, Bảo mật, Triển khai, Node.js.
3. Thêm một câu hỏi 4 phương án, chọn đáp án đúng, nhập giải thích. Tìm lại bằng từ khóa; chỉnh sửa câu hỏi.
4. Tạo đề mới: đặt 2 phút, 2 câu hỏi, chọn đúng 2 câu rồi đánh dấu mở đề.
5. Mở trình duyệt ẩn danh, đăng ký sinh viên mới. Vào đề vừa tạo, bắt đầu và chọn đáp án. Chờ thông báo đã lưu, tải lại trang để chứng minh dữ liệu và thời hạn được giữ.
6. Nộp bài, xem điểm và đáp án. Mở lịch sử để xem lượt thi đã lưu. Có thể làm một lượt khác, đóng tab và đợi hết giờ để kiểm tra worker tự chấm.
7. Trở lại tài khoản admin, lọc kết quả theo đề, mở chi tiết. Khóa sinh viên và kiểm tra quyền truy cập bị thu hồi.
8. Chỉ ra `src/services/attempts.js`, transaction/khóa hàng, schema SQL, Docker Compose, `.env.example`. Trình bày rằng điểm được tính từ snapshot phía server.

## Kiểm tra dữ liệu trực tiếp

Dùng MySQL Workbench kết nối host/port trong `.env`. Với helper Windows của dự án: host `127.0.0.1`, port `3317`; tài khoản và mật khẩu DB ở `.env`.

```sql
SELECT id, name, email, role, active FROM users;
SELECT id, exam_title, user_id, status, correct_count, score,
       started_at, expires_at, submitted_at FROM attempts ORDER BY id DESC;
SELECT attempt_id, position, selected_option, correct_option, is_correct
FROM answers ORDER BY attempt_id DESC, position;
```

Chỉ chạy SELECT để trình bày; không cần xóa hay đặt lại dữ liệu trước mỗi buổi demo. Nếu không có bài hoàn thành, dashboard sẽ hiển thị trạng thái trống và điểm trung bình `—` thay vì số liệu giả.
