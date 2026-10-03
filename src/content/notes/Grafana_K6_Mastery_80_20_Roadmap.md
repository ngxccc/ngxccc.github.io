---
title: "Nghiên cứu Grafana k6: Tiêu chuẩn Nắm chắc và Phương pháp học 80/20"
description: "Lộ trình làm chủ kiểm thử hiệu năng với Grafana k6 theo nguyên tắc 80/20, tập trung vào Workload Models, Coordinated Omission, Quality Gates, và tích hợp CI/CD."
date: "2026-10-02"
tags: ["type/method", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Methods/Engineering/Grafana_K6_Mastery_80_20_Roadmap.md"
---
## TL;DR

- **Bản chất**: Lộ trình chắt lọc 20% kiến thức Performance Engineering cốt lõi trong Grafana k6 (Workload Models, Coordinated Omission, Threshold Quality Gates, SharedArray, OS Tuning) thay vì học lan man 80% cú pháp script JavaScript đơn thuần.
- **Mục đích**: Xây dựng năng lực thiết kế kịch bản tải thực tế, tìm ra điểm gãy (Breakpoint) của hệ thống và chặn đứng suy thoái hiệu năng tự động trên CI/CD pipeline.
- **Điểm mấu chốt**: Phân biệt rạch ròi Closed vs Open Workload Models để loại bỏ sai lệch số liệu độ trễ, dùng `SharedArray` quản trị bộ nhớ và gắn kết chặt chẽ kết quả đo với Server-side Observability.

---

## Core Concepts: Tiêu chuẩn Nắm chắc Grafana k6

Ranh giới giữa một người **biết chạy script k6** và một kỹ sư **nắm chắc k6** nằm ở tư duy **Performance Engineering** chứ không phải việc nhớ cú pháp JavaScript. Một kỹ sư được coi là nắm chắc Grafana k6 khi thỏa mãn **5 tiêu chuẩn kiểm chứng** sau:

### 1. Hiểu bản chất Workload Model và xử lý triệt để Coordinated Omission

- **Bản chất**: Biết khi nào một bài test bị sai lệch số liệu do dùng sai Workload Model ([Scenarios: Open vs Closed Models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)).
- **Tiêu chuẩn đánh giá**:
  - Phân biệt rạch ròi:
    - **Closed Model** (`constant-vus`, `ramping-vus`): Lần lặp tiếp theo chỉ chạy khi lần trước kết thúc. Khi server bắt đầu nghẽn (latency tăng), k6 tự động gửi ít request hơn. Hiện tượng này gọi là **Coordinated Omission** — làm cho báo cáo $p_{95}, p_{99}$ latency đẹp giả tạo.
    - **Open Model** (`constant-arrival-rate`, `ramping-arrival-rate`): Request được bắn ra theo đúng nhịp định sẵn (RPS cố định), hoàn toàn độc lập với tốc độ phản hồi của server. k6 tự động cấp phát thêm Virtual Users (`maxVUs`) để duy trì áp lực thực tế.
  - Biết đọc chỉ số `dropped_iterations` để phát hiện tình trạng k6 cạn kiệt VU trước khi hoàn thành mục tiêu tải.

### 2. Thiết kế Test Profile có chủ đích theo Test Spectrum

- **Bản chất**: Không lao vào ép 10,000 VUs một cách cảm tính mà áp dụng quy trình chuẩn theo [k6 Testing Guides](https://grafana.com/docs/k6/latest/testing-guides/):
  - **Smoke Test**: 1–2 VUs, thời gian ngắn để kiểm tra tính toàn vẹn của kịch bản và môi trường.
  - **Average-Load / Baseline Test**: Tải thông thường để xác lập đường cơ sở (Baseline) cho SLOs.
  - **Stress Test & Breakpoint Test**: Tăng tải theo từng bậc thang (`stages`) để tìm điểm gãy của hệ thống, biết cấu hình `abortOnFail: true` trong Thresholds để dừng test ngay khi hệ thống sập, tránh phá hủy môi trường.
  - **Spike Test**: Đột biến tải tức thì (10x – 20x trong vài giây) rồi hạ về baseline để kiểm tra khả năng phục hồi (Recovery Time) và cơ chế Auto-scaling.
  - **Soak Test**: Chạy tải vừa phải trong nhiều giờ liên tục để phát hiện rò rỉ bộ nhớ (Memory Leak) và cạn kiệt Connection Pool.

### 3. Tách bạch Functional Assertions (`check`) và Performance SLOs (`thresholds`)

- **Bản chất**: Nắm được sự khác biệt cốt lõi nêu tại [Checks Documentation](https://grafana.com/docs/k6/latest/using-k6/checks/) và [Thresholds Documentation](https://grafana.com/docs/k6/latest/using-k6/thresholds/):
  - `check()` chỉ là assert logic cục bộ của từng request, **không làm fail tiến trình test và không trả về non-zero exit code**.
  - `thresholds` là định nghĩa chất lượng toàn cục (Quality Gate). Khi vi phạm, k6 trả về non-zero exit code để chặn pull request / build pipeline.
  - Biết kết hợp kỹ thuật cầu nối để ép pipeline fail nếu tỷ lệ check lỗi vượt quá mức cho phép:
    ```javascript
    export const options = {
      thresholds: {
        checks: ["rate>0.99"], // Fail CI/CD nếu tỷ lệ check đạt dưới 99%
        "http_req_duration{page:checkout}": ["p(95)<400"], // Phân tách SLO theo Tag
      },
    };
    ```

### 4. Quản trị tài nguyên của Load Generator (Tránh Test Bias)

- **Bản chất**: Không để máy chạy k6 bị nghẽn CPU, RAM, hoặc mạng dẫn đến đo sai kết quả của hệ thống mục tiêu ([Running Large Tests Guide](https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/)).
- **Tiêu chuẩn đánh giá**:
  - Sử dụng `SharedArray` từ module `k6/data` ([Data Parameterization](https://grafana.com/docs/k6/latest/examples/data-parameterization/)) để nạp dữ liệu test lớn (CSV/JSON) vào bộ nhớ Go một lần duy nhất, thay vì sao chép vào từng JavaScript VM của mỗi VU gây Out-Of-Memory.
  - Thiết lập `discardResponseBodies: true` khi không cần trích xuất payload từ response.
  - Giữ mức sử dụng CPU của load generator luôn dưới 80%.
  - Biết tinh chỉnh hệ điều hành Linux: tăng File Descriptors (`ulimit -n 250000`), bật tái sử dụng socket (`net.ipv4.tcp_tw_reuse`).

### 5. Đóng vòng lặp tương quan với Server-side Observability

- **Bản chất**: Không chỉ nhìn một mình bảng kết quả terminal của k6.
- **Tiêu chuẩn đánh giá**:
  - Phân rã được chỉ số thời gian: `http_req_blocked`, `http_req_connecting`, `http_req_tls_handshaking`, `http_req_waiting` (TTFB), và `http_req_receiving`.
  - Khi `http_req_waiting` tăng vọt, biết đối chiếu sang APM traces (Tempo/Jaeger), Metrics (Prometheus) và Logs (Loki) để xác định điểm nghẽn nằm ở tầng ứng dụng, I/O database, hay network gateway.

---

## Phương pháp 80/20 (Pareto) để học Grafana k6

Để đạt 80% hiệu quả thực chiến của một kỹ sư hiệu năng với chỉ 20% công sức, cần tập trung vào đúng **5 khối kiến thức trọng tâm (20%)** và **tạm gác lại các tính năng thứ yếu (80%)**.

```text
┌─────────────────────────────────────────────────────────────┐
│             20% CỐT LÕI (Đem lại 80% giá trị)               │
├─────────────────────────────────────────────────────────────┤
│ 1. Test Lifecycle: init -> setup() -> VU -> teardown()     │
│ 2. Scenarios & Executors: ramping-vus & arrival-rate        │
│ 3. Quality Gates: Checks + Thresholds (gắn Tag/Group)       │
│ 4. SharedArray: Quản lý bộ nhớ khi nạp dữ liệu ngoài        │
│ 5. Outputs: Built-in Web Dashboard & Prometheus/Cloud       │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼ (Gác lại tra cứu sau - 80%)
┌─────────────────────────────────────────────────────────────┐
│ Viết xk6 extensions bằng Go | Browser testing (Core Web     │
│ Vitals) | Distributed k6 trên K8s | Chaos (xk6-disruptor)   │
└─────────────────────────────────────────────────────────────┘
```

### 1. Khối 1: Test Lifecycle & Scope Execution

Nắm rõ thời điểm chạy và phạm vi dữ liệu của 4 giai đoạn ([Test Lifecycle Reference](https://grafana.com/docs/k6/latest/using-k6/test-lifecycle/)):

- `init context`: Khai báo biến, nạp file, định nghĩa options. Chạy **1 lần duy nhất cho mỗi VU** khi khởi tạo.
- `setup()`: Chạy **1 lần duy nhất trên toàn test run** trước khi VU bắt đầu. Dùng để đăng ký tài khoản test, lấy auth token, chuẩn bị database. Dữ liệu trả về từ hàm này được truyền vào VU code.
- `VU code` (`default function`): Chạy lặp đi lặp lại bởi các VU.
- `teardown(data)`: Chạy **1 lần duy nhất trên toàn test run** sau khi toàn bộ VU kết thúc. Dùng để dọn dẹp dữ liệu test, thu hồi tài nguyên, gửi thông báo webhook.

### 2. Khối 2: Scenarios & Executors

Hiểu và làm chủ 2 Executors đại diện cho 2 trường phái Workload Model ([Executors Reference](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/)):

- `ramping-vus` (Closed Model): Dùng cho Stress Test / Breakpoint Test để tìm ngưỡng chịu đựng của server.
- `ramping-arrival-rate` (Open Model): Dùng cho Benchmark cố định RPS để kiểm chứng cam kết SLO/SLA thực tế mà không bị sai lệch số liệu độ trễ.

### 3. Khối 3: Tags, Groups, Checks và Thresholds

- Gom nhóm các bước tương tác thành transaction logic bằng `group('Checkout', () => { ... })` để sinh ra metric `group_duration` ([Tags and Groups Docs](https://grafana.com/docs/k6/latest/using-k6/tags-and-groups/)).
- Gắn `tags` cho từng request để phân tích hiệu năng theo từng API endpoint riêng biệt (`http_req_duration{endpoint:login}`).
- Thiết lập `thresholds` tập trung vào tail latency ($p_{95}, p_{99}$ thay vì $average$):
  ```javascript
  thresholds: {
    'http_req_duration{endpoint:payment}': ['p(95)<300', 'p(99)<600'],
    'http_req_failed': ['rate<0.01'],
  }
  ```

### 4. Khối 4: Parameterization với `SharedArray`

- Tránh nạp file JSON/CSV trong hàm default hoặc nạp trực tiếp qua biến toàn cục thông thường.
- Sử dụng chuẩn [SharedArray API](https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray/):
  ```javascript
  import { SharedArray } from "k6/data";
  import exec from "k6/execution";

  const userList = new SharedArray("users", function () {
    return JSON.parse(open("./users.json"));
  });

  export default function () {
    // Tránh xung đột dữ liệu giữa các VU bằng phép chia lấy dư
    const user = userList[exec.scenario.iterationInTest % userList.length];
  }
  ```

### 5. Khối 5: Visualizing & CI/CD Pipeline

- **Quan sát trực quan tại local**: Kích hoạt built-in Web Dashboard mà không cần cài đặt thêm server giám sát phức tạp ([Web Dashboard Guide](https://grafana.com/docs/k6/latest/results-output/web-dashboard/)):
  ```bash
  K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=report.html k6 run script.js
  ```
- **Đưa vào CI/CD**: Cấu hình pipeline (GitHub Actions/GitLab CI) tự động fail khi exit code khác 0 dựa vào vi phạm Thresholds ([Automate k6 in CI/CD](https://grafana.com/docs/learning-paths/automate-k6-in-ci-cd-pipelines/)).

---

## Practical Implementation: Lộ trình Học Thực chiến

Grafana Labs cung cấp sẵn ứng dụng mẫu chính thức **[QuickPizza](https://quickpizza.grafana.com)** để thực hành mà không cần tự dựng backend. Thực hiện theo thứ tự 4 bài học này:

1. **Bước 1 (1–2 ngày)**: [Run your first k6 performance test](https://grafana.com/docs/learning-paths/run-your-first-k6-performance-test/)
   - Cài đặt CLI, viết script HTTP cơ bản, thêm `check()`, đọc bảng tóm tắt kết quả trên terminal.
2. **Bước 2 (2–3 ngày)**: [Establish a performance baseline with k6](https://grafana.com/docs/learning-paths/establish-a-performance-baseline-with-k6/)
   - Thiết lập ramping stages với `options`, phân tích phân phối $p_{95}$ latency, chuyển đổi kết quả đo thành các `thresholds` kiểm soát SLO.
3. **Bước 3 (2–3 ngày)**: [Find your system's limits with k6](https://grafana.com/docs/learning-paths/find-your-systems-limits-with-k6/) và [Test resilience with spike testing](https://grafana.com/docs/learning-paths/test-resilience-with-k6-spike-testing/)
   - Thiết lập kịch bản Breakpoint Test và Spike Test, sử dụng `abortOnFail` để tự ngắt khi tỷ lệ lỗi vượt ngưỡng cho phép.
4. **Bước 4 (2 ngày)**: [Automate k6 in CI/CD pipelines](https://grafana.com/docs/learning-paths/automate-k6-in-ci-cd-pipelines/)
   - Truyền biến môi trường động qua `__ENV`, tích hợp bước kiểm thử hiệu năng vào GitHub Actions/GitLab CI với exit code tiêu chuẩn.

---

## Related Notes

- [[K6_High_Concurrency_Load_Testing_SOP]]
- [[Open_vs_Closed_Workload_Models]]
- [[K6_Scenario_Executors_and_Workload_Modeling]]
- [[K6_Telemetry_Metrics_and_Threshold_Gates]]
- [[K6_Execution_Lifecycle_and_Memory_Architecture]]
- [[K6_Runner_Performance_and_OS_Tuning]]
- [[Master_Backend_Engineering_SSOT]]
- [[000_Methods_MOC]]
