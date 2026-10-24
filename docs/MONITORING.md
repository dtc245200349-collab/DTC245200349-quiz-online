
# Hướng dẫn triển khai Monitoring

## 1. Thành phần
- Prometheus: localhost:9090
- Grafana: localhost:3001
- Nginx Exporter: nginx-exporter:9113
- MySQL Exporter: mysql-exporter:9104
- cAdvisor: cadvisor:8080

## 2. Chuẩn bị môi trường
Cài Docker Desktop và Docker Compose.

Tạo file .env từ .env.example theo README.

Thiết lập mật khẩu mạnh:
- GRAFANA_ADMIN_PASSWORD
- MYSQL_EXPORTER_PASSWORD

Không commit file .env lên GitHub.

## 3. Khởi động ứng dụng
docker compose -f compose.yaml up -d --build

## 4. Tạo tài khoản giám sát MySQL

Truy cập container:
docker compose -f compose.yaml exec db sh

Đăng nhập:
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root

Chạy các câu SQL sau, thay mật khẩu mẫu bằng đúng
MYSQL_EXPORTER_PASSWORD trong .env:

CREATE USER IF NOT EXISTS 'quiz_monitor'@'%'
IDENTIFIED BY 'REPLACE_WITH_EXPORTER_PASSWORD'
WITH MAX_USER_CONNECTIONS 3;

ALTER USER 'quiz_monitor'@'%'
IDENTIFIED BY 'REPLACE_WITH_EXPORTER_PASSWORD';

GRANT PROCESS, REPLICATION CLIENT
ON *.* TO 'quiz_monitor'@'%';

GRANT SELECT ON performance_schema.*
TO 'quiz_monitor'@'%';

GRANT SELECT ON sys.*
TO 'quiz_monitor'@'%';

Thoát MySQL bằng exit;
Thoát shell bằng exit.

## 5. Khởi động Monitoring
docker compose -f compose.yaml -f compose.monitoring.yaml up -d

## 6. Kiểm tra
docker compose -f compose.yaml -f compose.monitoring.yaml ps

Prometheus:
http://localhost:9090/targets

Grafana:
http://localhost:3001

Đăng nhập Grafana bằng admin và mật khẩu trong .env.

Các target cần UP:
- prometheus
- nginx
- mysql
- cadvisor

## 7. Kiểm tra metrics
PromQL:
up
nginx_up
mysql_up
container_memory_usage_bytes

## 8. Dashboard
Tên: Quiz Online - System Monitoring

Dashboard được provision từ:
deploy/grafana/dashboards/quiz-system-monitoring.json
