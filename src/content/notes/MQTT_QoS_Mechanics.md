---
title: "MQTT QoS Mechanics"
description: "Nguyên lý tầng sâu của MQTT QoS: giải pháp The Two Generals' Problem, phân rã State Machine của QoS 0, QoS 1, QoS 2 (Two-Phase Commit Handshake), Inflight Window và cơ chế Idempotency."
date: "2026-09-24"
tags: ["type/concept", "status/permanent"]
aliases: ["MQTT QoS Mechanics", "MQTT Quality of Service", "MQTT Delivery Guarantees"]
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/MQTT_QoS_Mechanics.md"
---
# MQTT QoS Mechanics

## TL;DR

- **Bản chất**: **MQTT QoS (Quality of Service)** là một hợp đồng thỏa thuận mức độ tin cậy trong việc chuyển phát gói tin giữa Client và Broker trên một kênh truyền vật lý không ổn định.
- **Mục đích**: Cân bằng có chủ đích giữa thông lượng mạng (Throughput), độ trễ (Latency) và tính toàn vẹn dữ liệu (Data Integrity) nhằm hóa giải giới hạn phân tán của The Two Generals' Problem.
- **Điểm mấu chốt**: **QoS 0** là Best-Effort không lưu trạng thái (Zero ACK); **QoS 1** đảm bảo không mất tin bằng cơ chế ACK-Retransmission nhưng có thể gây Duplicate tin (bắt buộc Backend phải Idempotent); **QoS 2** sử dụng quy trình bắt tay 4 bước (4-Way Handshake / Two-Phase Commit thu nhỏ) triệt tiêu hoàn toàn mất mát và trùng lặp với cái giá là Latency cao nhất.

---

## Core Mechanics

### 1. The Two Generals' Problem & Đường biên Đánh đổi Tin cậy

Trong lý thuyết mạng máy tính phân tán, **The Two Generals' Problem** chứng minh rằng: Trên một môi trường mạng có độ trễ biến thiên và nguy cơ rớt gói tin (Packet Loss), hai nút tính toán **không bao giờ có thể đạt được sự đồng thuận tuyệt đối về trạng thái** chỉ bằng một số lượng hữu hạn các thông điệp xác nhận (Acknowledge).

Mọi giao thức chuyển phát đều phải chấp nhận đánh đổi:

1. **Liveness**: Đảm bảo gói tin luôn đến được đích.
2. **Safety**: Đảm bảo gói tin không bao giờ bị thực thi thừa hoặc trùng lặp.
3. **Overhead**: Giảm thiểu số vòng lặp mạng (Round-Trip Time - RTT) và mức tiêu thụ RAM lưu trữ trạng thái đệm.

MQTT QoS giải quyết bài toán này bằng cách phân tầng thành 3 cấp độ cam kết rõ rệt.

---

### 2. Giải phẫu Ba Cấp độ QoS State Machine

Mọi gói tin có QoS $\ge 1$ bắt buộc phải mang một trường nhị phân 16-bit gọi là **`Packet Identifier` (Packet ID)** có giá trị từ 1 đến 65.535 để định danh phiên trao đổi.

```
QoS 0: [PUBLISH] ───────────────────────────────────────────────► (Stateless)

QoS 1: [PUBLISH (PacketID=N)] ──────────────────────────────────►
       ◄─────────────────────────── [PUBACK (PacketID=N)] ─────── (Retransmit nếu Timeout)

QoS 2: [PUBLISH (PacketID=N)] ──────────────────────────────────► (Phase 1: Lock Message)
       ◄─────────────────────────── [PUBREC (PacketID=N)] ───────
       [PUBREL (PacketID=N)] ───────────────────────────────────► (Phase 2: Commit & Release)
       ◄─────────────────────────── [PUBCOMP (PacketID=N)] ──────
```

#### A. QoS 0: At Most Once (Best-Effort / Fire-and-Forget)

- **Cơ chế**: Bên gửi đẩy gói tin `PUBLISH` trực tiếp vào Socket Buffer của OS Kernel và giải phóng ngay lập tức khỏi bộ nhớ ứng dụng.
- **Trạng thái bộ nhớ**: Hoàn toàn không lưu trạng thái (Stateless). Không sử dụng `Packet ID`. Không có đồng hồ đếm ngược (Retry Timer).
- **Rủi ro**: Nếu kết nối mạng bị ngắt đúng thời điểm gói tin đang truyền, gói tin bị hủy hoàn toàn mà cả bên gửi lẫn bên nhận đều không hề hay biết.

#### B. QoS 1: At Least Once (ACK-Retransmission & Nguy cơ Duplicate)

- **Cơ chế**:
  1. Bên gửi gán `Packet ID = N`, ghi gói tin vào **Retransmission Queue (Inflight Table)** trong RAM, sau đó truyền gói `PUBLISH`.
  2. Bên nhận đón nhận gói tin, đẩy lên tầng ứng dụng xử lý, đồng thời gửi trả gói `PUBACK(N)`.
  3. Bên gửi chỉ xóa gói tin khỏi Retransmission Queue khi nhận được đúng gói `PUBACK(N)` tương ứng.
  4. Nếu Retry Timer hết hạn mà chưa thấy `PUBACK`, bên gửi bật cờ `DUP = 1` và gửi lại nguyên vẹn gói tin với `Packet ID = N`.
- **Cơ chế phát sinh trùng lặp (Duplicate Message Trap)**:
  - Nếu bên nhận đã nhận thành công `PUBLISH(N)` và đẩy vào database, nhưng gói phản hồi `PUBACK(N)` trên đường về bị đứt mạng hoặc quá hạn Timeout $\to$ Bên gửi kết luận sai rằng bên nhận chưa có dữ liệu $\to$ Bên gửi thực hiện Retransmit $\to$ **Bên nhận bị nhận gói tin đó lần thứ hai**.

#### C. QoS 2: Exactly Once (Two-Phase Commit 4-Way Handshake)

QoS 2 triệt tiêu hoàn toàn khả năng mất tin và trùng lặp thông qua quy trình hai pha (Two-Phase Commit) với 4 bước bắt tay:

- **Pha 1: Vận chuyển và Khóa dữ liệu (Transfer & Deduplication Lock)**:
  - Bên gửi truyền `PUBLISH(N)`. Trạng thái chuyển thành `AWAIT_PUBREC`.
  - Bên nhận nhận dữ liệu, ghi nhận `Packet ID = N` vào **Deduplication State Cache** để khóa lại. Bên nhận chưa giải phóng bản tin cho tầng ứng dụng tiêu thụ cuối cùng. Bên nhận gửi phản hồi `PUBREC(N)` (Publish Received).
  - Khi bên gửi nhận được `PUBREC(N)`, nó chắc chắn bên nhận đã cất giữ an toàn bản tin. Lúc này bên gửi **xóa payload thực tế khỏi RAM** để giải phóng bộ nhớ, chỉ giữ lại mã số định danh `N`.
- **Pha 2: Giải phóng và Hoàn tất (Commit & Complete)**:
  - Bên gửi truyền tiếp gói tin điều khiển `PUBREL(N)` (Publish Release). Trạng thái chuyển thành `AWAIT_PUBCOMP`.
  - Bên nhận nhận được `PUBREL(N)` $\to$ Đây là lệnh kích hoạt cho phép bên nhận chuyển tiếp payload lên tầng ứng dụng, đồng thời xóa `Packet ID = N` khỏi Deduplication State Cache $\to$ Bên nhận phản hồi `PUBCOMP(N)` (Publish Complete).
  - Bên gửi nhận `PUBCOMP(N)` $\to$ Thu hồi hoàn toàn `Packet ID = N` về bể ID rảnh rỗi (Free ID Pool).

---

### 3. Inflight Window, Packet ID Lifecycle & Backpressure

- **Inflight Window (Hạn ngạch gói tin đang bay)**:
  - Vì `Packet ID` chỉ có 16-bit (tối đa 65.535 ID khả dụng) và bộ nhớ RAM của thiết bị là hữu hạn, hệ thống không thể gửi đi vô hạn các gói tin chưa có xác nhận.
  - Chuẩn MQTT quy định một hạn mức cửa sổ (Inflight Window, thường cấu hình từ 10 đến 100). Khi số lượng gói tin QoS 1 và QoS 2 chưa nhận được `PUBACK` hoặc `PUBCOMP` chạm ngưỡng này, bên gửi phải tạm dừng gửi gói tin mới.
- **Hiện tượng Backpressure (Áp lực ngược)**:
  - Khi mạng bị nghẽn (Latency tăng cao, tỷ lệ rớt gói tin lớn), hàng đợi Inflight Window bị lấp đầy.
  - Tầng gửi (Publisher) bị nghẽn bộ đệm, buộc phải áp dụng chính sách chặn (Block Publisher Thread), đệm vào đĩa cứng (Disk Spooling), hoặc chủ động ngắt kết nối để bảo toàn bộ nhớ RAM.

---

### 4. Yêu cầu Bắt buộc tại Tầng Ứng dụng: Idempotency Pattern

Một ngộ nhận tai hại trong kiến trúc phần mềm là cho rằng: _"Chỉ cần chọn QoS 1 ở tầng mạng là dữ liệu của hệ thống sẽ an toàn tuyệt đối"_.

Thực tế, QoS 1 chỉ bảo vệ gói tin ở tầng truyền thông (Transport Level). Để xử lý triệt để nguy cơ trùng lặp bản tin do Retransmission gây ra, tầng ứng dụng Backend bắt buộc phải hiện thực hóa **Idempotent Consumer Pattern**:

- Mỗi bản tin nghiệp vụ phải chứa một mã định danh duy nhất sinh ra từ nguồn (ví dụ: `UUID` hoặc `timestamp + device_id`).
- Backend (Go Service) khi nhận bản tin từ MQTT Broker phải kiểm tra trạng thái khóa này (thông qua Redis `SET NX` hoặc PostgreSQL Unique Constraint) trước khi thực hiện ghi nhận dữ liệu hoặc kích hoạt cảnh báo.

---

## Comparative Decision Matrix

Áp dụng trong Hệ thống Giám sát & Điều khiển Máy phát điện Công nghiệp (Industrial Generator Management):

| Cấp độ QoS | Độ tin cậy                          |     Chi phí RTT mạng      | Tác động bộ nhớ RAM                      | Kịch bản ứng dụng chuẩn xác                                                                                                                             |
| :--------: | :---------------------------------- | :-----------------------: | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **QoS 0**  | Có thể mất tin, không bao giờ trùng |    $0$ (Không chờ ACK)    | Tối thiểu (Không lưu Inflight)           | **Đo đạc Telemetry định kỳ**: Điện áp, nhiệt độ, mức dầu gửi mỗi 1 giây/lần. Bản tin sau tự động bù đắp bản tin trước.                                  |
| **QoS 1**  | Không mất tin, có thể nhận trùng    |    $1$ RTT (`PUBACK`)     | Trung bình (Lưu Inflight Queue)          | **Cảnh báo bất thường (Alerts)**: Máy quá nhiệt $> 95^\circ\text{C}$, mất điện lưới, mức dầu cạn $< 10\%$. Thà nhận 2 lần cảnh báo còn hơn bị thất lạc. |
| **QoS 2**  | Không mất tin, không trùng lặp      | $2$ RTT (4-Way Handshake) | Cao (Lưu Inflight + Deduplication Cache) | **Lệnh điều khiển nhạy cảm (Critical Control)**: Lệnh tắt máy khẩn cấp từ xa, lệnh kích hoạt nổ máy chạy tải bệnh viện, lệnh thanh toán nạp nhiên liệu. |

---

## Related Notes

- [[MQTT_Broker_Architecture]]: Tổng quan kiến trúc định tuyến Trie và cơ chế Decoupling của MQTT Broker.
- [[Process_vs_Thread_and_Context_Switching]]: Cấu trúc luồng và chi phí chuyển đổi ngữ cảnh trong xử lý Concurrency.
- [[000_Concepts_MOC]]: Danh mục lý thuyết nền tảng Khoa học Máy tính.
