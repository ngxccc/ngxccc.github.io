---
title: "k6 Telemetry Metrics & Threshold Gates"
description: "Hệ thống chỉ số viễn trắc (Telemetry Metrics), cơ chế phân tách Tag và cấu hình ngưỡng Fail-Fast trong Grafana k6."
date: "2026-08-28"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Software_Testing/K6_Telemetry_Metrics_and_Threshold_Gates.md"
---
## TL;DR

- **Bản chất**: k6 tích hợp telemetry engine thu thập các mốc thời gian TCP/HTTP mặc định kết hợp 4 loại Custom Metric (`Counter`, `Trend`, `Rate`, `Gauge`).
- **Mục đích**: Thiết lập cổng kiểm soát chất lượng (Quality Gate) tự động đánh giá SLA độ trễ và các bất biến nghiệp vụ.
- **Điểm mấu chốt**: `check()` chỉ ghi nhận tỷ lệ thành công (Soft Assertion); `thresholds` là Hard Assertion quyết định mã thoát CI/CD ($Exit\ Code \ne 0$) và có thể kích hoạt dừng sớm khẩn cấp qua `abortOnFail: true`.

---

## Core Concept

### 1. Phân loại 4 Custom Metric Types (`k6/metrics`)

| Metric Type   | Ý nghĩa & Hành vi                                             | Trường hợp sử dụng chuẩn                                 |
| :------------ | :------------------------------------------------------------ | :------------------------------------------------------- |
| **`Counter`** | Số nguyên tích lũy tăng dần (`add(n)`).                       | Đếm số lượng đơn 201 Created, xung đột 409, lỗi 500.     |
| **`Trend`**   | Thu thập thống kê phân phối (min, max, avg, $p90, p95, p99$). | Đo lường độ trễ xử lý lock, thời gian phản hồi API.      |
| **`Rate`**    | Tỷ lệ phần trăm điều kiện đúng/sai ($0.0 \rightarrow 1.0$).   | Tỷ lệ request không lỗi (`rate > 0.99`), cache hit rate. |
| **`Gauge`**   | Lưu giữ giá trị tức thời gần nhất.                            | Đo lường số kết nối DB Pool đang mở, queue backlog.      |

---

### 2. Giải phẫu Độ trễ Mạng (HTTP Timings Anatomy)

```
[Tổng thời gian http_req_duration]
┌─────────┬────────────┬──────────────────┬─────────────────┬───────────┐
│ blocked │ connecting │ tls_handshaking  │ waiting (TTFB)  │ receiving │
└─────────┴────────────┴──────────────────┴─────────────────┴───────────┘
```

- `blocked`: Chờ socket rảnh trong connection pool hoặc phân giải DNS.
- `connecting` + `tls_handshaking`: Thiết lập TCP 3-way handshake và mã hóa TLS.
- `waiting` (Time to First Byte - TTFB): Thời gian server xử lý nghiệp vụ (Distributed Lock, DB Transaction). **Chỉ số quyết định hiệu năng backend**.
- `receiving`: Thời gian đọc dữ liệu phản hồi từ socket mạng.

---

### 3. So sánh `check()` vs `thresholds`

| Tiêu chí           | `check()` (Soft Assertion)              | `thresholds` (Hard Assertion / Quality Gate)  |
| :----------------- | :-------------------------------------- | :-------------------------------------------- |
| **Phạm vi**        | Từng HTTP response trong VU context     | Aggregated Metrics sau toàn bộ bài test       |
| **Tác động CI/CD** | Không làm fail pipeline (Exit Code = 0) | **Làm fail pipeline** (Exit Code = 99 hoặc 1) |
| **Mục đích**       | Báo cáo tỷ lệ đạt/hỏng, debug payload   | Thiết lập chốt chặn SLA và bất biến toán học  |

---

### 4. Cấu hình Ngưỡng Nâng cao (`abortOnFail` & `summaryTrendStats`)

- `abortOnFail: true`: Dừng ngay lập tức toàn bộ bài test khi một ngưỡng quan trọng bị vi phạm (ví dụ: phát hiện lỗi 500 hàng loạt), bảo vệ server khỏi bị quá tải kéo dài.
- `delayAbortEval: "1s"`: Khoảng trễ trước khi bắt đầu đánh giá điều kiện dừng sớm, tránh abort giả trong 1-2 request khởi động đầu tiên.
- `summaryTrendStats`: Tùy chỉnh danh sách các cột phân vị hiển thị trên CLI report (ví dụ: `["min", "avg", "p(95)", "p(99)", "max"]`).

---

## Practical Implementation

```typescript
import { post } from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

export const reserve201 = new Counter("reserve_success_201");
export const reserve409 = new Counter("reserve_conflict_409");
export const reserve500 = new Counter("reserve_unexpected_errors");
export const hotSeatDuration = new Trend("hot_seat_duration_ms");

export const options = {
  summaryTrendStats: ["min", "med", "avg", "p(90)", "p(95)", "p(99)", "max"],
  thresholds: {
    // Invariant: Duy nhất 1 ghế đặt thành công
    reserve_success_201: ["count==1"],
    // Invariant: 99 requests còn lại nhận 409
    reserve_conflict_409: ["count==99"],
    // Fail-Fast: Dừng test ngay lập tức nếu xuất hiện bất kỳ lỗi 500 nào
    reserve_unexpected_errors: [
      { threshold: "count==0", abortOnFail: true, delayAbortEval: "1s" },
    ],
    // SLA phân vị p95 cho kịch bản có tag
    "hot_seat_duration_ms{scenario:hot_seat}": ["p(95)<=700", "p(99)<=800"],
  },
};

export default function (): void {
  const params = {
    headers: { "Content-Type": "application/json" },
    tags: { scenario: "hot_seat" },
  };

  const res = post(
    "http://127.0.0.1:3000/reserve",
    JSON.stringify({ seatId: "A1" }),
    params,
  );

  hotSeatDuration.add(res.timings.duration);
  if (res.status === 201) reserve201.add(1);
  else if (res.status === 409) reserve409.add(1);
  else reserve500.add(1);

  check(res, {
    "status is 201 or 409": (r) => r.status === 201 || r.status === 409,
    "no 500 error": (r) => r.status !== 500,
  });
}
```

---

## Related Notes

- Kiến trúc bộ nhớ và vòng đời k6: [[K6_Execution_Lifecycle_and_Memory_Architecture]]
- Mô hình kịch bản thực thi k6: [[K6_Scenario_Executors_and_Workload_Modeling]]
- Quy chuẩn kiểm thử tải Concurrency: [[K6_High_Concurrency_Load_Testing_SOP]]
- 7 nguyên lý kiểm thử phần mềm nền tảng: [[7_Principles_of_Testing]]
- Khái niệm lỗi, khuyết tật và sự cố: [[Error_Defect_Failure]]
- Bản đồ tri thức kiểm thử: [[30_Resources/Concepts/000_Concepts_MOC.md|Concepts MOC]]
