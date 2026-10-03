---
title: "k6 Scenario Executors & Workload Modeling"
description: "Phân loại các cơ chế điều phối Executor, tham số gracefulStop và kiến trúc thực thi Scenarios trong Grafana k6."
date: "2026-08-28"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Software_Testing/K6_Scenario_Executors_and_Workload_Modeling.md"
---

# k6 Scenario Executors & Workload Modeling

## TL;DR

- **Bản chất**: k6 Scenarios điều phối lưu lượng kiểm thử độc lập hoặc tuần tự thông qua các cơ chế Executor chuyên biệt.
- **Mục đích**: Mô phỏng trung thực các dạng tải thực tế (Flash-Sale Burst, Traffic Spike, Soak Test, Rate-Limit Abuse) trên cùng một bộ runner.
- **Điểm mấu chốt**: Kiểm thử Race Condition và Distributed Lock bắt buộc dùng `per-vu-iterations` (`iterations: 1`) để tạo xung đột tức thời vi giây tại $t=0$; cấu hình rõ ràng `gracefulStop` để tránh k6 runner bị treo timeout ngoài ý muốn.

---

## Core Concept

### 1. Phân loại k6 Executors

| Nhóm Executor          | Loại cụ thể                                       | Đặc điểm điều phối                                                                                                                                                                 | Trường hợp sử dụng chuẩn                                     |
| :--------------------- | :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| **Iteration-based**    | `per-vu-iterations`<br>`shared-iterations`        | Cố định số lần chạy (`iterations`) cho từng VU hoặc chia sẻ chung.                                                                                                                 | Race Condition, Flash-Sale Burst, Data Partitioning.         |
| **VU-based**           | `constant-vus`<br>`ramping-vus`                   | Duy trì hoặc biến thiên số lượng VU chạy theo các mốc thời gian (`stages`).                                                                                                        | Tìm điểm gãy (Breaking Point), Soak Testing (tìm rò rỉ RAM). |
| **Arrival-rate-based** | `constant-arrival-rate`<br>`ramping-arrival-rate` | Cố định số request mỗi giây (RPS) độc lập với thời gian phản hồi của backend. Áp dụng Open Model loại trừ lỗi Coordinated Omission (chi tiết: [[Open_vs_Closed_Workload_Models]]). |

---

### 2. Mô hình hóa Kiểm thử Tranh chấp (Burst vs Ramping)

```
[Ramping VUs - Sai lầm khi test Race Condition / Lock]:
VU Count
  ▲      /‾‾‾‾\       => Requests đến server rải rác.
  │     /      \      => Lock kịp giải phóng giữa các chu kỳ -> Bỏ lọt lỗi Double-Booking.
  └────────────────► Time

[per-vu-iterations (iterations: 1) - Chuẩn xác cho Race Condition]:
Requests
  ▲   ║ (500 Requests va chạm tại t=0s)
  │   ║               => Bắt buộc toàn bộ VUs bắn request đồng loạt ở microsecond đầu tiên.
  │   ║               => Ép Redlock và PostgreSQL SELECT ... FOR UPDATE hoạt động cực hạn.
  └────────────────► Time
```

---

### 3. Tham số Điều phối Quan trọng (`gracefulStop` & `startTime`)

- `gracefulStop`: Khoảng thời gian cho phép các iterations đang chạy dở hoàn tất sau khi hết `maxDuration` (mặc định: `30s`). Trong kịch bản burst ngắn, cần cấu hình `gracefulStop: "1s"` hoặc `"0s"` để giải phóng runner ngay lập tức.
- `startTime`: Độ trễ bắt đầu kịch bản, cho phép sắp xếp chuỗi kiểm thử tuần tự (Sequential Execution) mà không cần viết script riêng.
- `exec`: Tên hàm JavaScript trong file kịch bản được chỉ định thực thi riêng cho scenario đó.

---

## Practical Implementation

```typescript
import { Options } from "k6/options";

export const options: Options = {
  discardResponseBodies: true,
  scenarios: {
    // 1. Burst Concurrency: 500 VUs tranh chấp 1 ghế duy nhất tại t=0s
    hot_seat_burst: {
      executor: "per-vu-iterations",
      vus: 500,
      iterations: 1,
      maxDuration: "10s",
      gracefulStop: "1s",
      exec: "hotSeatScenario",
      startTime: "0s",
    },
    // 2. Throttler Abuse: 1 VU spam 30 requests tại t=12s để test Rate Limiter
    rate_limit_abuse: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 30,
      maxDuration: "10s",
      gracefulStop: "0s",
      exec: "rateLimitScenario",
      startTime: "12s",
    },
  },
  thresholds: {
    reserve_success_201: ["count==1"],
    reserve_conflict_409: ["count==499"],
    "http_req_duration{scenario:hot_seat_burst}": ["p(95)<=700"],
  },
};

export function hotSeatScenario(): void {
  // Logic kiểm thử tranh chấp khóa ghế
}

export function rateLimitScenario(): void {
  // Logic kiểm thử spam request từ 1 IP duy nhất
}
```

---

## Related Notes

- Kiến trúc bộ nhớ và vòng đời k6: [[K6_Execution_Lifecycle_and_Memory_Architecture]]
- Mô hình Open vs Closed Workload và Coordinated Omission: [[Open_vs_Closed_Workload_Models]]
- Hệ thống đo lường và ngưỡng kiểm định k6: [[K6_Telemetry_Metrics_and_Threshold_Gates]]
- Quy chuẩn kiểm thử tải Concurrency: [[K6_High_Concurrency_Load_Testing_SOP]]
- Cơ chế khóa phân tán Redis Redlock: [[Redis_Redlock]]
- Cơ chế khóa bi quan Postgres: [[Postgres_Select_For_Update_Pessimistic_Locking]]
- Chiến lược ngăn chặn DDoS và Rate Limiting: [[Multi_Layer_Rate_Limiting_DDoS_Prevention]]
- Bản đồ tri thức kiểm thử: [[30_Resources/Concepts/000_Concepts_MOC.md|Concepts MOC]]
