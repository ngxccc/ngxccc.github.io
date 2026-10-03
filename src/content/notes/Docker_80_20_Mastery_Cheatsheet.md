---
title: "Docker 80/20 Mastery Cheatsheet"
description: "Cẩm nang tra cứu nhanh Docker 80/20: tổng hợp các lệnh cốt lõi thường dùng nhất về Container Lifecycle, Storage Volumes, Network Ports, Exec Debugging, Resource Limits và Safe Garbage Collection."
date: "2026-10-02"
tags: ["type/method", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Methods/Engineering/Docker_80_20_Mastery_Cheatsheet.md"
---
# Docker 80/20 Mastery Cheatsheet

## TL;DR

- **Bản chất**: Cẩm nang nén **20% nhóm lệnh Docker** phục vụ cho **80% nhu cầu thực tế** của một Backend / DevOps Engineer: từ khởi tạo Container có kiểm soát, gắn Volume bền vững, ánh xạ Network Port, Debugging bên trong Container đến Dọn dẹp ổ cứng an toàn (Safe Cleanup).
- **Mục đích**: Chuẩn hóa thao tác dòng lệnh, loại bỏ rủi ro rò rỉ dung lượng ổ cứng từ Anonymous Volumes, tránh tình trạng Container treo chiếm dụng RAM/CPU, và tăng tốc độ thao tác trong môi trường phát triển cục bộ lẫn Production.
- **Điểm mấu chốt**: Ưu tiên cờ `--rm` cho các tác vụ kiểm thử ngắn hạn, luôn định danh Named Volume thay vì để Docker tự sinh Anonymous Volume ngầm, sử dụng `docker system df` để kiểm tra tài nguyên và `docker volume prune` để thu hồi dung lượng đĩa mồ côi.

---

## Context: When to use

Sử dụng cẩm nang này trong các tình huống sau:

- Khởi chạy nhanh các cơ sở dữ liệu và hạ tầng đệm (PostgreSQL, MySQL, Redis, RabbitMQ, Kafka) cho dự án cục bộ.
- Truy cập vào môi trường Shell bên trong Container để kiểm tra kết nối mạng, đọc file cấu hình hoặc xem tiến trình đang chạy.
- Giám sát mức độ tiêu thụ RAM, CPU của các Containers qua terminal theo thời gian thực.
- Kiểm tra và dọn dẹp dung lượng ổ cứng máy chủ/máy phát triển khi bị cảnh báo đầy đĩa do Image và Volume rác.

---

## Step-by-Step

### 1. Container Lifecycle: Khởi chạy và Quản lý Cơ bản

#### Khởi chạy có kiểm soát (Run with Discipline)

```bash
# 1. Chạy bài lab / test nhanh (Tự động xóa container và volume khi tắt - KHÔNG RÁC Ổ CỨNG)
docker run --rm -d --name <container_name> -p <host_port>:<container_port> <image_name>

# Ví dụ thực chiến với Redis (Cực kỳ an toàn cho học tập):
docker run --rm -d --name redis-drill -p 6379:6379 redis:7-alpine

# 2. Chạy dịch vụ cố định (Giữ dữ liệu qua Named Volume và tự khởi động lại khi crash)
docker run -d \
  --name postgres-dev \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=app_db \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16-alpine
```

#### Quản lý trạng thái Container

```bash
# Xem danh sách container đang chạy
docker ps

# Xem toàn bộ container (kể cả những container đã tắt / exit)
docker ps -a

# Xem kích thước dung lượng thực tế của từng container (Write layer size)
docker ps -s

# Dừng, bật lại, khởi động lại container
docker stop <container_name>
docker start <container_name>
docker restart <container_name>

# Ép dừng ngay lập tức (Gửi SIGKILL)
docker kill <container_name>

# Xóa container đã dừng
docker rm <container_name>

# Ép xóa container đang chạy (Dừng và xóa trong 1 lệnh)
docker rm -f <container_name>
```

---

### 2. Debugging, Inspection & Logs: Truy vết Sự cố

```bash
# 1. Xem logs theo thời gian thực (Follow logs tương tự tail -f)
docker logs -f <container_name>

# Xem 100 dòng log gần nhất kèm timestamp
docker logs --tail 100 -t <container_name>

# 2. Truy cập vào bên trong Container (Mở Interactive Shell)
# Dùng bash (nếu base image là Ubuntu/Debian)
docker exec -it <container_name> bash

# Dùng sh (nếu base image là Alpine Linux)
docker exec -it <container_name> sh

# 3. Chạy 1 câu lệnh trực tiếp từ host mà không cần mở shell
docker exec -it redis-drill redis-cli ping
docker exec -it postgres-dev psql -U admin -d app_db -c "\dt"

# 4. Kiểm tra chi tiết cấu hình mạng, IP, Mounts dạng JSON
docker inspect <container_name>
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <container_name>

# 5. Xem danh sách tiến trình (Processes) đang chạy trong container
docker top <container_name>
```

---

### 3. Resource Limits & Monitoring: Giám sát Tài nguyên

Ngăn chặn một container bị rò rỉ bộ nhớ làm sập cả máy host:

```bash
# 1. Giới hạn RAM và CPU khi khởi chạy container
docker run -d --name limited-app \
  --memory="512m" \
  --memory-swap="1g" \
  --cpus="1.5" \
  my-app:latest

# 2. Xem bảng điều khiển tiêu thụ RAM, CPU, Network I/O, Disk I/O theo thời gian thực (Top for Docker)
docker stats

# Xem stats một lần duy nhất mà không stream liên tục (dùng cho script automation)
docker stats --no-stream
```

---

### 4. Storage & Volumes: Quản trị Lưu trữ Bền vững

```bash
# 1. Xem danh sách các Volumes trên máy host
docker volume ls

# 2. Tạo Named Volume chủ động
docker volume create redis-data

# 3. Kiểm tra đường dẫn vật lý trên ổ cứng của Volume
docker volume inspect redis-data

# 4. Xóa 1 volume cụ thể (Chỉ xóa được khi không có container nào đang gắn vào)
docker volume rm redis-data

# 5. XÓA TOÀN BỘ VOLUMES MỒ CÔI (Dangling Volumes - Giải phóng dung lượng đĩa quan trọng nhất)
docker volume prune -f
```

---

### 5. Networks: Kết nối Đa Container Cục bộ

Khi cần các container nhìn thấy nhau bằng Domain Name (ví dụ Backend App kết nối tới Database):

```bash
# 1. Tạo một Custom Bridge Network
docker network create app-network

# 2. Chạy database và backend cùng mạng (Chúng tự phân giải tên cho nhau)
docker run -d --name db-service --network app-network postgres:16-alpine
docker run -d --name api-service --network app-network -p 8080:8080 my-api:latest
# Trong api-service, chuỗi kết nối database chỉ cần gọi hostname là 'db-service:5432'

# 3. Xem các container đang cắm vào network
docker network inspect app-network

# 4. Xóa network rác không sử dụng
docker network prune -f
```

---

### 6. Images & Safe Garbage Collection: Kỷ luật Dọn dẹp Đĩa

```bash
# 1. BÁC SĨ KIỂM TRA Ổ CỨNG: Xem Docker đang ngốn bao nhiêu dung lượng
docker system df

# Xem chi tiết từng item chiếm dung lượng
docker system df -v

# 2. Xóa các Container đã dừng (Exited)
docker container prune -f

# 3. Xóa các Images rác dạng <none> (Dangling Images sinh ra khi build đè bản mới)
docker image prune -f

# 4. Xóa Image không còn container nào dùng (Unused Images)
docker image prune -a -f

# 5. LỆNH DỌN DẸP TOÀN DIỆN (Đưa môi trường test về trạng thái sạch sẽ hoàn toàn)
# Xóa: Tất cả container đã tắt + Tất cả volumes không dùng + Tất cả networks không dùng + Tất cả images không dùng
docker system prune -a --volumes -f
```

---

## Bảng Tra cứu Cờ Dòng Lệnh 80/20 (Quick Flags Reference)

| Cờ (Flag)         | Tên đầy đủ  | Ý nghĩa thực chiến                                                                 |
| :---------------- | :---------- | :--------------------------------------------------------------------------------- |
| `-d`              | `--detach`  | Chạy container ở chế độ background (ngầm), nhả terminal ngay lập tức.              |
| `--rm`            | N/A         | **Tự hủy hoàn toàn**: Tự xóa container và anonymous volume khi container dừng lại. |
| `-p <h>:<c>`      | `--publish` | Ánh xạ Port máy host `<h>` vào Port của container `<c>`.                           |
| `-v <src>:<dest>` | `--volume`  | Gắn Volume hoặc Bind Mount thư mục từ host vào container.                          |
| `-e <KEY>=<VAL>`  | `--env`     | Truyền biến môi trường vào container.                                              |
| `--name <name>`   | N/A         | Đặt tên định danh dễ nhớ thay vì để Docker tự sinh tên ngẫu nhiên.                 |
| `-it`             | `-i --tty`  | Mở chế độ tương tác (Interactive Terminal) để gõ lệnh trực tiếp.                   |
| `--restart`       | N/A         | Chính sách tự khởi động: `always`, `unless-stopped`, `on-failure`.                 |

---

## Related Notes

- [[Master_Backend_Engineering_SSOT]]: Chuẩn mực hạ tầng và kỹ thuật Backend.
- [[Linux_Mastery_Core_Roadmap]]: Lộ trình làm chủ quản trị hệ thống Linux và dòng lệnh.
- [[000_Methods_MOC]]: Danh mục quy trình, hướng dẫn và phương pháp kỹ thuật.
