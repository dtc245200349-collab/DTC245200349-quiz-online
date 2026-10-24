# Báo cáo kiểm thử thực tế

Ngày kiểm tra: **09/10/2026** (giờ Việt Nam). Môi trường: Windows, Node.js **24.19.0**, npm **11.17.0**, MySQL Community **8.0.46**, Chrome headless qua Playwright.

## Kết quả cuối

| Hạng mục | Kết quả |
|---|---|
| `npm.cmd test` | **7/7 đạt**: tính điểm/làm tròn, kiểm tra đáp án, số câu, email/mật khẩu, cấu hình, compile EJS, escape XSS |
| `npm.cmd run check` | **25 file JavaScript** qua kiểm tra cú pháp |
| `node scripts/run-integration.js` | **11/11 đạt**, chạy HTTP thật với MySQL, không mock dữ liệu |
| `node scripts/run-integration.js --browser` | **Đạt**, Chrome desktop 1440px và điện thoại 390px |
| `/health` | **HTTP 200**, database connected |
| Cài dependency và audit npm | Cài thành công, **0 lỗ hổng** được npm báo tại thời điểm cài |
| Docker Compose YAML | Parse YAML thành công; kiểm tra 2 service, dependency healthy, named volume |
| Build/chạy container Docker | **Chưa chạy được vì máy chưa cài Docker/Docker Desktop** |

## Các ca tích hợp đã chạy

1. Đăng ký lưu bcrypt; client gửi `role=admin` vẫn chỉ tạo student; email trùng bị chặn; tài khoản đăng nhập được.
2. Khách không vào được quản trị; sinh viên bị 403; POST thiếu CSRF hoặc token Unicode sai bị 403; payload SQL Injection không đăng nhập được.
3. Tất cả trang quản trị, sinh viên và health render từ dữ liệu MySQL.
4. Bắt đầu đồng thời tạo đúng một lượt thi; HTML không lộ đáp án/giải thích; sinh viên khác không đọc hoặc nộp hộ bài.
5. Tự lưu đáp án; sửa câu hỏi gốc không sửa snapshot; server bỏ qua điểm giả do client gửi; nộp lại không đổi điểm hoặc thời điểm nộp.
6. Bài hết giờ bỏ qua đáp án gửi muộn và chỉ chấm phần đã lưu.
7. Worker chấm bài hết giờ ngay cả khi trình duyệt đã đóng.
8. Thêm/sửa/tìm/xóa câu hỏi và đề thi; chặn sai số câu; chặn xóa câu đang dùng; lưu trữ đề giữ nguyên kết quả cũ; escape nội dung XSS.
9. Chặn ID câu trả lời không thuộc bài; hai lần nộp song song cho cùng một kết quả.
10. Session trong MySQL dùng được qua instance Express mới; logout vô hiệu session cũ.
11. Khóa sinh viên thu hồi quyền của phiên đang đăng nhập ở request kế tiếp.

## Chrome QA

- Đăng nhập sinh viên, xem đề, bắt đầu thi, chọn đáp án.
- Đợi tự lưu, tải lại trang: 5 đáp án vẫn được giữ, đồng hồ hoạt động.
- Nộp bằng biểu mẫu thực, xác nhận điểm **10.00/10** và trang đáp án.
- Đăng nhập quản trị, xem dashboard, tạo một đề bằng giao diện và xác nhận đã lưu.
- Kiểm tra không tràn ngang ở 390px: dashboard, câu hỏi, tạo đề, sinh viên, báo cáo và trang làm bài.
- Mở/đóng sidebar điện thoại bằng nút riêng.
- Làm bài ở kích thước điện thoại; đưa deadline của bài QA về quá khứ, tải lại và xác nhận chuyển đến kết quả **Hết giờ**.
- Không ghi nhận lỗi JavaScript, CSP hoặc HTTP trong các luồng đã kiểm tra.

Ảnh chụp thật lưu ở `.runtime/screenshots`: `login-desktop.png`, `student-desktop.png`, `exam-desktop.png`, `result-desktop.png`, `admin-desktop.png`, `admin-mobile.png`, `student-mobile.png`, `exam-mobile.png`.

## Lỗi phát hiện và đã sửa

- Form có key đáp án thuần số bị parser chuyển thành mảng, gây HTTP 400 khi nộp. Đã thêm tiền tố cho key HTML, giữ nguyên ID và kiểm tra hồi quy bằng HTTP/Chrome.
- Nút mở sidebar bị che khi menu điện thoại mở. Đã thêm nút đóng bên trong menu, hỗ trợ Escape và kiểm tra Chrome.
- MySQL Windows không đọc đúng đường dẫn dữ liệu có dấu. Helper dùng junction ASCII được xác minh trỏ đúng thư mục dự án và thư mục làm việc ASCII; MySQL khởi động thành công.
- Token CSRF Unicode có cùng số ký tự nhưng khác số byte: đã kiểm tra độ dài byte trước so sánh an toàn.

## Phạm vi và dữ liệu kiểm thử

- MySQL riêng chạy **127.0.0.1:3317**, dữ liệu ở `.runtime/mysql/data`. Không sửa hoặc dừng dịch vụ MySQL có sẵn trên máy.
- Database ứng dụng `quiz_online` có 2 tài khoản, 20 câu hỏi và 3 đề thi mẫu; chưa tạo kết quả giả.
- Các bộ test tạo database riêng tên ngẫu nhiên `quiz_test_*` / `quiz_browser_*` rồi giữ lại; không DROP database. Các lượt thử thất bại trước sửa cũng được giữ lại.
- Database của lần tích hợp cuối: `quiz_test_1791519041192_2461bf`.
- Database của lần Chrome QA cuối: `quiz_browser_1791519132769_ca9510`.
- Chưa kiểm thử tải lớn, nhiều instance, HTTPS/reverse proxy thật hoặc phục hồi backup. Dockerfile/Compose sẵn sàng để kiểm chứng trên máy có Docker Engine; không khẳng định đã chạy container.
