---
title: "Open vs Closed Workload Models"
description: "Phân định bản chất cơ học giữa Open Workload Model và Closed Workload Model, công thức Little's Law và hiện tượng Coordinated Omission trong kiểm thử tải."
date: "2026-10-01"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Software_Testing/Open_vs_Closed_Workload_Models.md"
---
## TL;DR

- **Bản chất**: Closed Model kích hoạt request tiếp theo phụ thuộc vào thời điểm hoàn tất của request trước đó; Open Model phát request độc lập theo nhịp định sẵn (Arrival Rate).
- **Mục đích**: Lựa chọn đúng cơ chế phát tải để mô phỏng trung thực hành vi người dùng thực tế và loại trừ hiện tượng sai lệch số liệu đo lường.
- **Điểm mấu chốt**: Dùng sai Closed Model cho Public API sẽ kích hoạt lỗi **Coordinated Omission** — khi Server nghẽn, máy phát tải tự động giảm tốc độ gửi request, khiến báo cáo phân vị độ trễ ($p_{95}, p_{99}$) hiển thị đạt chuẩn giả tạo.

---

## Core Concept

### 1. Cơ chế Vận hành: Vòng lặp vs Nhịp phát

```
[Closed Model - Vòng lặp phụ thuộc (Loop-driven)]:
VU ──► Send Request ──► Server Chậm (Wait...) ──► Receive ──► Sleep ──► Next Request
(Tốc độ phát tải bị trói buộc trực tiếp vào Response Time của Server)

[Open Model - Nhịp phát độc lập (Schedule-driven)]:
Clock Tick (Mỗi 1ms) ──► Bắn 1 Request (1,000 RPS)
Clock Tick (Mỗi 1ms) ──► Bắn 1 Request (1,000 RPS)
(Tốc độ phát tải độc lập với Response Time; k6 tự tăng Virtual Users để bù đắp)
```

| Đặc tính                   | Closed Workload Model                                                                                       | Open Workload Model                                                                                                 |
| :------------------------- | :---------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Cơ chế kích hoạt**       | Iteration tiếp theo chỉ bắt đầu sau khi iteration trước đó kết thúc (hoặc sau `sleep`).                     | Request được kích hoạt theo lịch trình cố định (Arrival Rate) dựa trên xung nhịp thời gian.                         |
| **Tương quan thông lượng** | Thông lượng tỷ lệ nghịch với Response Time. Server chậm $\to$ Throughput phát ra tự động giảm.              | Thông lượng cố định theo cấu hình (`rate`). Server chậm $\to$ Bộ phát tải cấp phát thêm VU để giữ đúng Target Rate. |
| **Công thức điều phối**    | Số lượng Virtual User cố định ($N = \text{const}$).                                                         | Tuân theo **Định luật Little**: $N = \lambda \times W$ (với $\lambda$: Arrival Rate, $W$: Latency).                 |
| **Rủi ro đo lường**        | **Coordinated Omission**: Bỏ sót mẫu đo khi hệ thống quá tải, làm sai lệch phân vị độ trễ $p_{95}, p_{99}$. | **Resource Exhaustion**: Cạn kiệt bộ nhớ hoặc socket của Load Generator nếu Server chậm kéo dài.                    |
| **Môi trường phù hợp**     | Hệ thống nội bộ (ERP, CRM) với số user cố định; hoặc bài test cướp lock tại thời điểm $t=0$.                | Public API, Web E-commerce, Flash-Sale, Webhook Ingestion, hoặc đo kiểm cam kết SLO.                                |

---

### 2. Hiện tượng Coordinated Omission

**Coordinated Omission** (Sự bỏ sót có phối hợp) là lỗi đo lường phổ biến nhất trong kiểm thử hiệu năng khi áp dụng sai Closed Model cho các hệ thống có lưu lượng đến ngẫu nhiên (Stochastic Arrival).

#### Quá trình phát sinh sai lệch số liệu:

1. **Server gặp sự cố**: Server tạm ngừng xử lý hoặc chậm đột biến do Stop-The-World Garbage Collection, cạn kiệt Connection Pool, hoặc Lock Contention (Response Time tăng từ $10\text{ms} \to 10\text{s}$).
2. **Load Generator bị phong tỏa**: Trong Closed Model, toàn bộ Virtual User đang hoạt động đều rơi vào trạng thái chờ (blocked) phản hồi từ Server.
3. **Suy giảm tần suất lấy mẫu (Sampling Bias)**: Do không thể gửi request mới trong suốt $10\text{s}$ nghẽn, bộ phát tải chỉ thu được một lượng rất nhỏ mẫu đo bị chậm (ví dụ: 10 mẫu), trong khi ở giai đoạn mượt mà trước đó thu thập được $10,000$ mẫu.
4. **Bẫy thống kê phân vị**: Khi tính toán các phân vị $p_{95}$ hay $p_{99}$, thuật toán thống kê tự động loại bỏ số ít mẫu chậm này vì chúng chỉ chiếm tỷ lệ không đáng kể ($< 0.1\%$).
5. **Hậu quả**: Báo cáo tổng kết hiển thị $p_{99}$ hoàn toàn xanh rờn và đạt cam kết SLO, trong khi thực tế ngoài đời hàng nghìn người dùng đã bị tắc nghẽn hoặc gặp lỗi timeout.

---

### 3. Khung Quyết định Chọn Model (Decision Framework)

Để lựa chọn chính xác mô hình tải, kiểm chứng bằng câu hỏi:

$$\text{"Khi Server phản hồi chậm, người dùng ngoài đời có ngừng gửi request đến không?"}$$

- **Nếu KHÔNG**: Bắt buộc sử dụng **Open Model** (`constant-arrival-rate`, `ramping-arrival-rate`). Toàn bộ lưu lượng từ Internet (khách mua hàng, đối tác gọi webhook, thiết bị IoT gửi telemetry) đều hoạt động theo cơ chế này.
- **Nếu CÓ**: Sử dụng **Closed Model** (`constant-vus`, `ramping-vus`, `per-vu-iterations`). Áp dụng khi mô phỏng nhân viên nội bộ thao tác tuần tự trên giao diện (phải đợi trang hiển thị mới bấm tiếp), hoặc khi kiểm thử xung đột đồng thời tức thì (Concurrency Burst) để săn Race Condition.

---

## Related Notes

- Mô hình điều phối kịch bản trong k6: [[K6_Scenario_Executors_and_Workload_Modeling]]
- Hệ thống đo lường và ngưỡng kiểm định k6: [[K6_Telemetry_Metrics_and_Threshold_Gates]]
- Kiến trúc bộ nhớ và vòng đời k6: [[K6_Execution_Lifecycle_and_Memory_Architecture]]
- Quy chuẩn kiểm thử tải Concurrency: [[K6_High_Concurrency_Load_Testing_SOP]]
- Phân vị độ trễ và thông lượng: [[Latency_Percentiles_p50_p95_p99_Throughput]]
- Bản đồ tri thức kiểm thử: [[30_Resources/Concepts/000_Concepts_MOC.md|Concepts MOC]]
