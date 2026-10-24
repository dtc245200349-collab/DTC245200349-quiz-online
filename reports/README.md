# Báo cáo cuối kỳ — Đề 35

Mã sinh viên: **DTC245200349**. Tên đề tài: **Hệ thống Quiz / Thi trắc nghiệm trực tuyến**.

Đợt thực hiện bắt đầu ngày 24/10/2026. Báo cáo Word tối thiểu 10 trang sẽ được hoàn thiện tại mốc 3, sau khi có dữ liệu và minh chứng triển khai thực tế. Chưa gán kết quả cho các hạng mục Prometheus, Grafana, Loki, Promtail chưa triển khai.

## Bố cục dự kiến khi dàn trang Word

1. Trang bìa: tên trường/khoa, môn học, đề 35, mã sinh viên, họ tên và giảng viên (bổ sung thông tin còn thiếu).
2. Mục tiêu, yêu cầu, phạm vi và công nghệ.
3. Kiến trúc toàn hệ thống và luồng dữ liệu.
4. Thiết kế website, các chức năng quản trị/sinh viên.
5. ERD, khóa ngoại, transaction, snapshot câu hỏi, deadline và chấm điểm.
6. Docker Compose, Nginx, phpMyAdmin và lưu trữ bền vững.
7. GitHub và ba mốc commit đã được duyệt.
8. Prometheus, exporters, Grafana và các biểu đồ từ dữ liệu thật.
9. Loki, Promtail (ghi phiên bản/EOL), datasource và LogQL.
10. Hardening: cấu hình, lý do và bằng chứng kiểm thử từng biện pháp.
11. Kết quả kiểm thử, backup/restore, lỗi phát hiện và cách khắc phục.
12. Kết luận, giới hạn và hướng phát triển.

Tài liệu đầu vào: `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION-PLAN.md`, `docs/DOCKER-STAGE1.md`, `docs/BACKUP-RESTORE.md`, báo cáo kiểm thử từng giai đoạn.

Checklist ảnh thật: [screenshots/README.md](screenshots/README.md). Bằng chứng tự động lưu trong `reports/evidence/` và bị Git ignore. Không lấy ảnh Chrome local của phiên trước để chứng minh Docker/Nginx hoặc monitoring.
