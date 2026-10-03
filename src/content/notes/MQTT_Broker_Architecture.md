---
title: "MQTT Broker Architecture"
description: "Nguyên lý tầng sâu của MQTT Broker: mô hình Publish/Subscribe, cơ chế Decoupling ba chiều, cấu trúc cây tiền tố Trie trong RAM định tuyến Topic, và Non-blocking I/O Kernel Multiplexing."
date: "2026-09-24"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/MQTT_Broker_Architecture.md"
---

# MQTT Broker Architecture

## TL;DR

- **Bản chất**: **MQTT Broker** là một Stateful In-Memory Routing Hub hoạt động theo mô hình Publish/Subscribe trên nền TCP, trung chuyển bản tin nhị phân giữa các Client phân tán mà không đòi hỏi kết nối trực tiếp Point-to-Point.
- **Mục đích**: Triệt tiêu ràng buộc không gian, thời gian và đồng bộ (Space, Time, Synchronization Decoupling) giữa thiết bị biên và hệ thống Backend, tối ưu hóa băng thông mạng không ổn định bằng Wire Protocol siêu nhẹ (Fixed Header 2 bytes).
- **Điểm mấu chốt**: Broker tổ chức bảng định tuyến Topic trong RAM bằng cấu trúc cây tiền tố **Trie** với độ phức tạp $O(L)$ theo độ sâu Topic (độc lập với số lượng Subscriber); đồng thời giữ hàng trăm ngàn kết nối TCP nhàn rỗi thông qua cơ chế Non-blocking I/O Kernel Multiplexing (`epoll` trên Linux).

---

## Core Mechanics

### 1. Phân rã Ràng buộc Ba chiều (Three-Dimensional Decoupling)

Trong các giao thức hướng Client-Server truyền thống (như HTTP REST hoặc gRPC RPC), kết nối bị trói buộc chặt chẽ bởi ba rào cản vật lý:

```
Point-to-Point (HTTP/RPC):
[Client A] ─────────────(Cần biết IP, cùng Online, chờ ACK)─────────────► [Server B]

Publish / Subscribe (MQTT Broker):
[Publisher] ──(Gửi vào Topic)──► ┌─────────────┐ ──(Forward tin)──► [Subscriber 1]
                                 │ MQTT BROKER │
[Publisher] ──(Gửi vào Topic)──► │ (Trie RAM)  │ ──(Forward tin)──► [Subscriber 2]
                                 └─────────────┘
```

MQTT Broker loại bỏ toàn bộ ba ràng buộc này:

- **Phân tách không gian (Space Decoupling)**: Publisher và Subscriber hoàn toàn không biết địa chỉ IP hay Port của nhau. Chúng chỉ thiết lập một kết nối TCP duy nhất hướng tới Broker và giao tiếp thông qua chuỗi định danh logic gọi là `Topic`.
- **Phân tách thời gian (Time Decoupling)**: Hai bên không cần phải cùng Online tại một thời điểm. Khi Subscriber mất kết nối, Broker duy trì `Persistent Session` trong RAM/Disk và tự động đẩy dồn các bản tin tồn đọng ngay khi Subscriber tái kết nối.
- **Phân tách đồng bộ (Synchronization Decoupling)**: Tiến trình xuất bản tin của Publisher diễn ra bất đồng bộ. Publisher không bị khóa luồng thực thi (Thread Blocking) để chờ đợi các Subscriber xử lý xong nghiệp vụ.

---

### 2. Cấu trúc Dữ liệu Định tuyến trong RAM: Prefix Tree (Trie)

Topic trong MQTT có dạng đường dẫn phân cấp bằng dấu gạch chéo `/` (ví dụ: `factories/area-1/generators/gen-01/telemetry`).

Để hỗ trợ lọc dữ liệu theo ký tự đại diện (Wildcards):

- Ký tự đại diện đơn tầng (`+`): Khớp chính xác một phân đoạn.
- Ký tự đại diện đa tầng (`#`): Khớp toàn bộ các phân đoạn con phía sau.

Bảng băm (Hash Table) thông thường thất bại trong việc tra cứu Wildcard vì không thể băm các mẫu động. Do đó, MQTT Broker tổ chức không gian Topic bằng cấu trúc cây tiền tố **Trie**:

```
                              (Root)
                                │
                            factories
                                │
                             area-1
                                │
                            generators
                            /        \
                       gen-01        gen-02
                         │              │
                     telemetry      telemetry
                     [Sub: S1]      [Sub: S2]
                         \              /
                          \            /
                        [Wildcard Sub: S3 (+)]
```

- **Cơ chế khớp mẫu (Matching Engine)**: Mỗi phân đoạn Topic tạo thành một Node trên cây Trie. Các Client đăng ký Subscribe được lưu trữ dưới dạng danh sách con trỏ (Pointers) tại Node lá hoặc Node chứa Wildcard.
- **Độ phức tạp thuật toán**: Khi một bản tin đến, Broker phân tách Topic thành $L$ phân đoạn và duyệt cây từ Root xuống. Độ phức tạp tìm kiếm là $O(L)$, phụ thuộc duy nhất vào độ sâu của Topic, hoàn toàn không suy giảm hiệu năng khi số lượng Subscriber tăng từ hàng chục lên hàng trăm ngàn Client.

---

### 3. Wire Protocol & Tối ưu hóa Tầng Mạng (Network & Kernel Footprint)

Khác với HTTP mang gánh nặng văn bản ASCII lớn (Headers chiếm 500 – 2000 bytes cho Cookies, User-Agent, Keep-Alive), MQTT được thiết kế ở mức nhị phân (Binary Wire Protocol):

- **Fixed Header tối giản 2 bytes**:
  - Byte 1: `Packet Type` (4 bits: `CONNECT`, `PUBLISH`, `PUBACK`...) + Flags (4 bits: `DUP`, `QoS`, `RETAIN`).
  - Byte 2 (trở lên): `Remaining Length` sử dụng thuật toán mã hóa số nguyên có độ dài biến thiên (Variable Byte Integer), dùng từ 1 đến 4 bytes để biểu diễn kích thước payload lên tới 256MB.
- **Kernel Multiplexing (`epoll` / `kqueue`)**:
  - Broker duy trì các kết nối TCP thường trực (Persistent Connections) mà không tạo mỗi Thread cho mỗi Client.
  - Sử dụng cơ chế hướng sự kiện bất đồng bộ (Event-driven I/O Multiplexing), một Process đơn lẻ của Broker có thể quản lý hơn 100.000 Socket đồng thời với mức sử dụng RAM chỉ vài KB cho mỗi Socket Buffer của OS Kernel.
- **Keep-Alive & PINGREQ/PINGRESP**:
  - Broker giám sát trạng thái sống của kết nối qua chu kỳ Keep-Alive. Nếu trong khoảng thời gian thỏa thuận Client không gửi dữ liệu, nó sẽ bắn gói tin `PINGREQ` (chỉ 2 bytes) và Broker đáp lại bằng `PINGRESP` (2 bytes) để xác nhận Socket còn thông suốt mà không cần tốn chi phí thiết lập lại TCP 3-Way Handshake.

---

### 4. Quản lý Phiên (Session State Lifecycle)

Khi Client gửi gói tin `CONNECT`, cờ `CleanSession` (hoặc `CleanStart` trong MQTT v5) định đoạt vòng đời trạng thái trên Broker:

- **CleanSession = true (Transient Session)**:
  - Broker hủy bỏ toàn bộ Session cũ của Client ID đó.
  - Khi ngắt kết nối, mọi dữ liệu đệm, danh sách Subscription và các gói tin đang bay (Inflight Messages) bị xóa sạch khỏi RAM.
- **CleanSession = false (Persistent Session)**:
  - Broker lưu giữ trạng thái của Client bao gồm: Toàn bộ danh sách Topic Subscriptions, hàng đợi tin nhắn chưa gửi (Offline Message Queue) có [[MQTT_QoS_Mechanics|QoS]] $\ge 1$, và các bản tin đang trong tiến trình đàm phán ACK chưa hoàn tất.
  - Khi Client tái kết nối với cùng `Client ID`, Broker khôi phục lại Session ngay lập tức và tiếp tục xả hàng đợi tin nhắn.

---

## Practical Engineering Context

Trong hệ thống Giám sát Vận hành Máy phát điện Công nghiệp (Industrial Generator Telemetry):

| Đặc tính                      | Mô hình HTTP REST API truyền thống                   | Mô hình MQTT Broker Ingestion                                |
| :---------------------------- | :--------------------------------------------------- | :----------------------------------------------------------- |
| **Giao thức kết nối**         | HTTP/1.1 hoặc HTTP/2 qua TCP ngắn hạn                | TCP Persistent Connection dài hạn                            |
| **Băng thông mạng**           | Tốn ~800 bytes HTTP headers cho mỗi lần đẩy          | Chỉ tốn 2 bytes Fixed Header cho mỗi telemetry push          |
| **Tải trên Edge CPU**         | Phải mã hóa văn bản, bắt tay TLS/TCP liên tục        | Giữ nguyên Socket, đẩy binary payload trực tiếp              |
| **Khả năng điều khiển ngược** | Khó khăn (phải dùng HTTP Long-polling / Webhook)     | Tức thì: Backend Publish vào `gen-01/command`, máy nhận ngay |
| **Hành vi khi đứt mạng**      | Gói tin thất lạc hoàn toàn nếu Client không tự retry | Broker lưu trữ tin nhắn trong Persistent Session             |

---

## Related Notes

- [[MQTT_QoS_Mechanics]]: Đặc tả chi tiết cơ chế thỏa thuận độ tin cậy QoS 0, QoS 1, QoS 2 và Two-Phase Commit State Machine.
- [[Process_vs_Thread_and_Context_Switching]]: Nguyên lý tài nguyên tiến trình và cơ chế Non-blocking I/O của Kernel.
- [[000_Concepts_MOC]]: Mục lục tri thức nền tảng Khoa học Máy tính và Hệ thống.
