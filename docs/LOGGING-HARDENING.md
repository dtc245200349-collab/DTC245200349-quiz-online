
# Logging va Hardening - Quiz Online

## 1. He thong log tap trung

Thanh phan:
- Loki 3.7.0: luu tru va truy van log
- Promtail 3.6.11: thu thap log Docker
- Grafana: truy van LogQL

Luu y: Promtail da het ho tro, chi su dung
cho bai thuc hanh theo yeu cau giang vien.

## 2. Trien khai

Yeu cau da hoan thanh cau hinh .env va
thiet lap tai khoan MySQL Exporter.

Chay lenh:

docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml up -d --build

Kiem tra:

docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml ps

Dia chi:
- Quiz Online: http://localhost:8080
- phpMyAdmin: http://localhost:8081
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- Loki Ready: http://localhost:3100/ready

## 3. Truy van LogQL

Truy van 1 - Toan bo log Docker:

{job="docker"}

Truy van 2 - Loc log Nginx:

{job="docker"} | json | service="nginx"

Truy van 3 - Dem log trong 5 phut:

sum(count_over_time({job="docker"}[5m]))

Truy van bo sung - Tim loi:

{job="docker"} |~ "(?i)error|warn|failed"

## 4. Luu tru

Loki su dung Docker volume loki_data.
Promtail su dung Docker volume promtail_positions.

Khong chay docker compose down -v
khi can giu du lieu.

## 5. Hardening

Da kiem tra:
1. Network isolation frontend/backend.
2. Nginx Security Headers.
3. MySQL Exporter su dung tai khoan han che quyen.
4. Loki chay non-root UID 10001.
5. Loki khong chay privileged.
6. no-new-privileges.
7. Mat khau duoc quan ly qua .env, khong commit.
8. Cac cong dich vu quan tri tren host
   duoc gioi han truy cap 127.0.0.1.

## 6. Luu y bao mat

Loki dang tat authentication de phuc vu
demo cuc bo. Khong cong khai Loki ra Internet.

Can bo sung authentication, network isolation
chi tiet hon va thay Promtail bang Grafana Alloy
neu trien khai production.
