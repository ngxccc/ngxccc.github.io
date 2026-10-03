---
title: "Latency Percentiles and Throughput Fundamentals"
description: "Nguyên lý đo lường hiệu năng hệ thống: Phân vị độ trễ (p50, p90, p95, p99), bẫy số trung bình (Flaw of Averages), Tail Latency, và thông lượng hệ thống (Throughput / Ops per second / RPS)."
date: "2026-09-22"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/Latency_Percentiles_and_Throughput_Fundamentals.md"
---
# Latency Percentiles and Throughput Fundamentals

## TL;DR

- **Bản chất**: **Throughput (Ops/sec hoặc RPS)** đo tốc độ xử lý khối lượng công việc của hệ thống trên một đơn vị thời gian. **Latency Percentiles ($p50, p90, p95, p99$)** đo phân bố thời gian phản hồi thực tế của từng nhóm người dùng, phản ánh rủi ro **Tail Latency** mà số trung bình (Mean/Average) hoàn toàn che giấu.
- **Mục đích**: $p50$ (Median) đại diện cho trải nghiệm người dùng phổ thông. $p95$ và $p99$ là tiêu chuẩn vàng để cam kết SLA/SLO (Service Level Agreement/Objective), bảo vệ nhóm khách hàng chịu độ trễ tồi tệ nhất.
- **Điểm mấu chốt**: Không bao giờ dùng **Số trung bình (Average)** để đánh giá hiệu năng API vì $1\%$ request bị nghẽn (ví dụ: Stop-The-World Garbage Collection, Lock Contention, Disk I/O) sẽ bị số lượng lớn request nhanh làm lu mờ. Trong kiến trúc Microservices, nếu $p99$ của một service con chậm, toàn bộ request tổng hợp của người dùng sẽ bị kéo chậm theo quy tắc xác suất nhị thức.

---

## Core Concept

### 1. Throughput: Đơn vị Đo lường Khối lượng Công việc

- **Throughput (Thông lượng)**: Số lượng thao tác (Operations) hoặc yêu cầu (Requests) mà hệ thống hoàn tất thành công trong một giây.
- **Đơn vị**:
  - **RPS (Requests Per Second)**: Dùng cho Web API / HTTP Server.
  - **QPS (Queries Per Second)**: Dùng cho Database (PostgreSQL, MySQL).
  - **Ops/sec (Operations Per Second)**: Dùng cho Benchmark thuật toán, CPU, Cache Redis, Disk I/O.
- **Mối quan hệ Little's Law trong Hệ thống Hàng đợi**:
  $$L = \lambda \times W$$
  Trong đó:
  - $L$: Số lượng request đang nằm trong hệ thống (Concurrency / In-flight requests).
  - $\lambda$: Throughput (RPS).
  - $W$: Latency trung bình (Response time).
  - **Ý nghĩa thực chiến**: Nếu Latency $W$ tăng gấp 10 lần (do nghẽn DB), để duy trì cùng một Throughput $\lambda$, hệ thống bắt buộc phải giữ số lượng kết nối đồng thời $L$ gấp 10 lần $\rightarrow$ Dẫn đến cạn kiệt Connection Pool và tràn RAM.

---

### 2. Bẫy Số Trung Bình (The Flaw of Averages)

Giả sử kiểm thử 100 requests với kết quả thời gian phản hồi:

- 99 requests phản hồi siêu tốc: $10\text{ms}$.
- 1 request bị dính Lock Timeout hoặc Garbage Collection: $10,000\text{ms}$ ($10$ giây).

**Tính số trung bình (Mean / Average):**
$$\text{Average Latency} = \frac{(99 \times 10) + (1 \times 10,000)}{100} = \frac{990 + 10,000}{100} \approx 109.9\text{ms}$$

👉 **Hậu quả**: Con số $109.9\text{ms}$ nhìn có vẻ "khá tốt", nhưng nó hoàn toàn che giấu sự thật rằng có khách hàng đã phải đứng chờ tới $10$ giây và có thể đã bỏ giỏ hàng!

---

### 3. Latency Percentiles: $p50, p90, p95, p99$

Để nhìn thấy sự thật, ta sắp xếp toàn bộ $N$ thời gian phản hồi theo thứ tự tăng dần từ bé đến lớn:

```
[10ms, 10ms, 12ms, 15ms, ..., 45ms, ..., 120ms, ..., 3500ms]
  │                            │          │            │
  ▼                            ▼          ▼            ▼
p50 (Trung vị)                p90        p95          p99 (Đuôi dài - Tail)
```

- **$p50$ (50th Percentile / Median - Trung vị)**:
  - $50\%$ số lượng requests có thời gian phản hồi nhỏ hơn hoặc bằng giá trị này.
  - Phản ánh trải nghiệm của nhóm người dùng thông thường trong điều kiện lý tưởng.
- **$p90$ (90th Percentile)**:
  - $90\%$ requests phản hồi nhanh hơn mốc này. $10\%$ còn lại bắt đầu chậm hơn.
- **$p95$ (95th Percentile - Chuẩn SLA Tiêu biểu)**:
  - $95\%$ requests hoàn tất dưới mốc này. Chỉ có $5\%$ người dùng gặp độ trễ cao hơn.
  - Mức cam kết tiêu chuẩn cho hầu hết các API ứng dụng thương mại điện tử và tài chính.
- **$p99$ (99th Percentile - Tail Latency / Worst Case)**:
  - Mốc thời gian mà $99\%$ requests nhanh hơn, và đại diện cho $1\%$ requests tồi tệ nhất.
  - **Tại sao $p99$ lại sống còn?**
    - $1\%$ người dùng thường là những tài khoản lớn (Power Users: giỏ hàng nhiều sản phẩm nhất, lịch sử giao dịch dài nhất, đại lý mua sỉ khối lượng lớn).
    - Trong kiến trúc Microservices, một trang chủ gọi 50 service con song song. Xác suất để người dùng dính phải ít nhất một service bị dính $p99$ là:
      $$P = 1 - (1 - 0.01)^{50} \approx 1 - 0.605 = 39.5\%$$
      Nghĩa là gần $40\%$ người dùng sẽ phải chịu độ trễ của $p99$!

---

### Bảng So sánh Ma trận Đo lường

| Chỉ số               | Ý nghĩa kỹ thuật                    | Hiện tượng gây ra                                            | Mục tiêu tối ưu   |
| :------------------- | :---------------------------------- | :----------------------------------------------------------- | :---------------- |
| **Throughput (RPS)** | Số lượng công việc hoàn tất/giây    | Quá tải CPU, nghẽn I/O, bão hòa băng thông                   | Càng cao càng tốt |
| **$p50$ Latency**    | Trải nghiệm người dùng thông thường | Tốc độ xử lý code thuần túy, truy vấn index chuẩn            | $< 20\text{ms}$   |
| **$p95$ Latency**    | Ngưỡng cam kết SLA chính thức       | Hàng đợi Connection Pool, tranh chấp tài nguyên nhẹ          | $< 100\text{ms}$  |
| **$p99$ Latency**    | Đuôi trễ cực đoan (Tail Latency)    | Stop-The-World GC, Row-Level Lock Contention, Disk Flush WAL | $< 500\text{ms}$  |

---

## Practical Implementation

### Đọc Báo cáo k6 Performance Benchmark

```text
     ✓ status is 200

     checks.........................: 100.00% ✓ 1500      ✗ 0
     http_req_duration..............: avg=32.4ms min=8.1ms med=18.2ms max=890.5ms p(90)=42.1ms p(95)=68.4ms p(99)=185.2ms
     http_reqs......................: 1500    99.82/s
```

- `http_reqs`: Đạt thông lượng xấp xỉ $100\text{ RPS}$ (Requests Per Second).
- `med` ($p50$): $18.2\text{ms}$ (Người dùng bình thường nhận kết quả cực nhanh).
- `p(95)`: $68.4\text{ms}$ (Đạt cam kết SLA dưới $100\text{ms}$).
- `p(99)`: $185.2\text{ms}$ và `max`: $890.5\text{ms}$ (Cảnh báo: Có hiện tượng nghẽn nhẹ do tranh chấp khóa cơ sở dữ liệu ở nhóm $1\%$ cuối cùng).

---

## Related Notes

- [[Finite_State_Machine_and_Concurrency_Guard]]: Tranh chấp khóa ảnh hưởng trực tiếp đến $p99$ latency.
- [[Master_Backend_Engineering_SSOT]]: Tiêu chuẩn vàng hiệu năng hệ thống backend.
- [[000_Concepts_MOC]]: Danh mục lý thuyết nền tảng khoa học máy tính.
