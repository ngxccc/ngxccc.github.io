---
title: "k6 Runner Performance & OS Kernel Tuning"
description: "Nguyên lý tối ưu hiệu năng máy chạy k6, kiểm soát Tag Cardinality và tinh chỉnh kernel OS khi kiểm thử quy mô lớn."
date: "2026-08-28"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Software_Testing/K6_Runner_Performance_and_OS_Tuning.md"
---
## TL;DR

- **Bản chất**: Hiệu năng của k6 load generator bị giới hạn bởi 2 yếu tố: cấu hình kernel hệ điều hành (Socket/File Descriptors) và mức tiêu thụ RAM của Go runtime do Tag Cardinality.
- **Mục đích**: Đảm bảo máy runner có thể chịu tải từ 2,000 đến 10,000 VUs mà không bị sập vì cạn kiệt socket (`bind: address already in use`) hoặc tràn bộ nhớ do time-series metrics.
- **Điểm mấu chốt**: Tuyệt đối không đưa ID động vào Metric Tags; tinh chỉnh `systemTags` để giảm 30% RAM; mở rộng `ulimit -n 65535` và bật `tcp_tw_reuse` ở tầng OS.

---

## Core Concept

### 1. Thảm họa Bùng nổ Tag Cardinality (Metric Memory Explosion)

k6 lưu trữ và tổng hợp các Metric (`Counter`, `Trend`, `Rate`) trong bộ nhớ theo từng tổ hợp Tag duy nhất (Unique Tag Combination).

```
[Anti-Pattern: Đưa UUID / Timestamp vào Tags]
Metric: http_req_duration
  ├── Tag { scenario: "burst", user_id: "usr_001" } ──► 1 Time-series Object trên RAM
  ├── Tag { scenario: "burst", user_id: "usr_002" } ──► 1 Time-series Object trên RAM
  └── Tag { scenario: "burst", user_id: "usr_N"   } ──► N Time-series Objects (RAM cạn kiệt)

[Best Practice: Chỉ dùng Static Low-Cardinality Tags]
Metric: http_req_duration
  └── Tag { scenario: "burst" } ──────────────────────► 1 Time-series Object duy nhất
```

- **Quy tắc bất biến**: Chỉ gán các giá trị tĩnh, hữu hạn vào `tags` (ví dụ: `scenario: "hot_seat"`, `endpoint: "reserve"`). Các giá trị định danh động (`uuid`, `token`, `user_id`) chỉ được đặt trong HTTP Headers hoặc Body.

---

### 2. Tinh giản `systemTags` Giảm tải CPU & RAM

Mặc định, k6 thu thập hàng chục System Tags cho mỗi HTTP request (`proto`, `subproto`, `tls_version`, `vu`, `iter`, `ip`, `ocsp_status`, `group`). Khi test ở quy mô hàng nghìn VUs:

- **Tác động**: Việc thu thập metadata thừa làm tăng CPU overhead của Goja runtime và tăng kích thước file xuất kết quả.
- **Giải pháp**: Khai báo danh sách tinh gọn trong `options.systemTags`:
  ```typescript
  systemTags: ["status", "method", "url", "scenario", "check", "error", "error_code"],
  ```

---

### 3. Tinh chỉnh Kernel OS cho Load Generator (Linux / macOS)

Khi chạy 2,000 VUs đồng thời, mỗi VU mở ít nhất 1 TCP connection. Nếu hệ điều hành giữ các thông số mặc định, bài test sẽ fail giả lập do lỗi từ chính máy runner:

| Thông số Kernel                    | Mặc định       | Khuyến nghị cho k6 | Tác dụng giải quyết                                            |
| :--------------------------------- | :------------- | :----------------- | :------------------------------------------------------------- |
| **`ulimit -n`** (File Descriptors) | 1,024          | `65535`            | Tránh lỗi `socket: too many open files`.                       |
| **`net.ipv4.ip_local_port_range`** | `32768 60999`  | `1024 65535`       | Mở rộng dải ephemeral ports từ ~28,000 lên ~64,000 cổng.       |
| **`net.ipv4.tcp_tw_reuse`**        | `0` (Disabled) | `1` (Enabled)      | Cho phép tái sử dụng các socket đang ở trạng thái `TIME_WAIT`. |
| **`net.core.somaxconn`**           | 128 / 4096     | `65535`            | Tăng hàng đợi tiếp nhận kết nối TCP của OS.                    |

---

### 4. Vòng đời Xuất Báo cáo Tinh gọn (`handleSummary`)

Thay vì in toàn bộ log thô ra terminal hoặc dùng external tools nặng nề, k6 hỗ trợ hook `handleSummary(data)` ở Root Scope:

- Chạy 1 lần duy nhất sau khi `teardown()` kết thúc.
- Cho phép xuất kết quả dưới dạng JSON tĩnh, HTML Report hoặc gửi trực tiếp vào Slack/GitHub Actions summary artifact.

---

## Practical Implementation

### 1. Cấu hình k6 Options Tối ưu Hóa Toàn diện

```typescript
import { Options } from "k6/options";

export const options: Options = {
  // 1. Loại bỏ response body khỏi RAM
  discardResponseBodies: true,

  // 2. Chỉ giữ các system tags thiết yếu
  systemTags: [
    "status",
    "method",
    "url",
    "scenario",
    "check",
    "error",
    "error_code",
  ],

  // 3. Tùy chỉnh phân vị hiển thị
  summaryTrendStats: ["min", "med", "avg", "p(90)", "p(95)", "p(99)", "max"],

  // 4. Request Timeout mặc định ngăn treo socket
  timeout: "5s",

  scenarios: {
    hot_seat: {
      executor: "per-vu-iterations",
      vus: 2000,
      iterations: 1,
      maxDuration: "10s",
      gracefulStop: "1s",
    },
  },
};

// 5. Hook xuất báo cáo JSON tinh gọn cho CI/CD
export function handleSummary(data: unknown) {
  return {
    stdout: JSON.stringify(data, null, 2),
    "dist/summary.json": JSON.stringify(data),
  };
}
```

### 2. Script Tinh chỉnh OS Runner (Linux Host)

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Mở rộng File Descriptors
ulimit -n 65535

# 2. Tinh chỉnh TCP Networking qua sysctl
sudo sysctl -w net.ipv4.ip_local_port_range="1024 65535"
sudo sysctl -w net.ipv4.tcp_tw_reuse=1
sudo sysctl -w net.core.somaxconn=65535
sudo sysctl -w net.ipv4.tcp_fin_timeout=15
```

---

## Related Notes

- Kiến trúc bộ nhớ và vòng đời k6: [[K6_Execution_Lifecycle_and_Memory_Architecture]]
- Mô hình kịch bản thực thi k6: [[K6_Scenario_Executors_and_Workload_Modeling]]
- Hệ thống đo lường và ngưỡng kiểm định k6: [[K6_Telemetry_Metrics_and_Threshold_Gates]]
- Quy chuẩn kiểm thử tải Concurrency: [[K6_High_Concurrency_Load_Testing_SOP]]
- Hướng dẫn Benchmark cục bộ: [[Local_Stress_Testing_Benchmark]]
- Bản đồ tri thức kiểm thử: [[30_Resources/Concepts/000_Concepts_MOC.md|Concepts MOC]]
