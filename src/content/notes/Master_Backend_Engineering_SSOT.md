---
title: "Master Backend Engineering SSOT & Strategy Compass"
description: "Single Source of Truth (SSOT), Active Workbench, 6 Evergreen Fundamentals, Diagnostic Protocols, and 4-Layer Cognitive Roadmap for Backend & Software Engineers."
date: "2026-08-16"
tags: ["type/guide", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Methods/Engineering/Master_Backend_Engineering_SSOT.md"
---
## TL;DR

Tài liệu này là **Single Source of Truth (SSOT)** và **Interactive Command Center** định hình toàn bộ lộ trình phát triển năng lực, tư duy kiến trúc, và tiêu chuẩn kỹ nghệ cho Backend & Software Engineering. Được xây dựng dựa trên triết lý kỹ nghệ của các kỹ sư huyền thoại (_Salvatore Sanfilippo (antirez)_, _Mitchell Hashimoto_, _Fabrice Bellard_, _Martin Fowler_): **Giá trị cốt lõi đến từ độ sâu kiến trúc, khả năng giải quyết bài toán phức tạp bằng giải pháp tối giản (KISS), và sự thấu hiểu bản chất cách hệ thống vận hành under the hood.**

---

## 1. Strategic Intent & Active Sprint Workbench

_Khu vực điều phối hành động - Khi mất phương hướng, nhìn vào đây đầu tiên để kéo tiêu điểm về bài toán hiện tại:_

### A. North Star & Timeline

- **Target Role**: Offer Backend Developer chính thức (Node.js, NestJS, Go, PostgreSQL, Redis, System Design) trước ngày **06/12/2026**.
- **CV Golden Metrics**:
  - Throughput & Latency: `RPS > 1,500 req/sec` dưới `p95 Latency < 45ms` trên dự án Ticket Booking Backend.
  - Concurrency Control: 100% Zero Race Condition chứng minh qua Asynchronous Socket Flooding & Redis Redlock.
  - Architecture Boundaries: Phân tách ranh giới rõ ràng theo Modular Monolith và Clean Architecture, triệt tiêu Circular Dependency.
  - Automated Verification: Đạt chuẩn Playwright Automation Testing (CDP/IPC, Contract Drift, JSON Schema).

### B. Current Active Sprint (Work in Progress)

- [ ] Tích hợp và chuẩn hóa toàn bộ hệ thống Second Brain theo tiêu chuẩn SSOT.
- [ ] **Ticket Booking Backend**: Hoàn thiện kịch bản k6 Load Test, đo RPS/Latency và đóng gói số liệu vào CV.
- [ ] **Software Testing Coursework**: Hoàn thiện toàn diện dự án Playwright Automation Testing (16 bài phân tích kiến trúc).
- [ ] **Daily Technical Discipline**: 1 bài LeetCode Medium/ngày (15 Patterns) + Ôn 20 thẻ Anki (`50_Flashcards/`).

---

## 2. The 4 Evergreen Knowledge Pillars (Active Progression)

_Cây lộ trình 4 tầng nhận thức - Đánh dấu `[x]` khi đã nghiệm thu và mint flashcard, `[/]` khi đang code thực chiến, `[ ]` cho nốt chờ nghiên cứu/ôn tập lại từ đầu:_

### Pillar 1: Under-the-Hood, Networking & Low-Level Runtime (Layer 1)

#### Computer Science & OS Process / Memory Execution

- [x] [[Stack_vs_Heap_Memory_Fundamentals]]
- [x] [[Process_vs_Thread_and_Context_Switching]]
- [ ] [[Concurrency_Primitives_Mutex_Semaphore_Atomic]]
- [ ] [[Garbage_Collection_Fundamentals]]
- [ ] [[Memory_Leaks_Core_Mechanics]]
- [ ] [[Dynamic_Array_Exponential_Growth]]
- [ ] [[Heap_Memory_Size_Classes_and_Alignment]]

#### JavaScript Engine & V8 Internals

- [ ] [[JS_Stack_vs_Heap_Memory]]
- [ ] [[JS_Event_Loop]]
- [ ] [[JS_Generational_Garbage_Collection]]
- [ ] [[JS_Memory_Leaks_and_Mitigation]]
- [ ] [[JS_V8_Hidden_Classes_Inline_Caching]]
- [ ] [[JS_Destructuring]]
- [ ] [[AST_ESLint]]
- [ ] [[JS_Temporal_API]]
- [ ] [[JS_Immer_Immutable_State]]

#### Go Runtime & Memory Mechanics

- [ ] [[Go_Slice_Underlying_Mechanics]]
- [ ] [[Go_Array_Vs_Slice_Distinction]]
- [ ] [[Go_Escape_Analysis_Mechanics]]

#### Type Systems & Compilers

- [ ] [[TS_Type_System_Structural_Type_Erasure]]
- [ ] [[TS_Distributive_Conditional_Types]]
- [ ] [[TS_Type_Utilities_Omit_Pick_Exclude]]
- [ ] [[TS_Decorators]]
- [ ] [[Tree_Shaking]]

#### Low-Level Networking, Sockets & I/O Multiplexing

- [ ] [[TCP_Handshake_and_Connection_Lifecycle]]
- [ ] [[TCP_Connection_Pooling_and_KeepAlive]]
- [ ] [[Socket_Lifecycle_and_File_Descriptors]]
- [ ] [[Client_Side_Encryption]]
- [ ] [[TLS_SSL_Handshake_Mechanics]]
- [ ] [[HTTP_Protocol_Evolution_HTTP1_HTTP2_HTTP3]]
- [ ] [[WebSockets_vs_gRPC_Streaming]]
- [ ] [[Event_Loop_and_IO_Multiplexing_Epoll]]
- [ ] [[Serverless_Architecture]]
- [ ] [[Edge_Computing]]
- [ ] [[NextJS_after_API]]

---

### Pillar 2: Architecture, Boundaries, Auth & Clean Code (Layer 2)

#### Architecture Principles & Paradigms

- [ ] [[Clean_Architecture]]
- [ ] [[SOLID_Principles]]
- [ ] [[Domain_Driven_Design]]
- [ ] [[Layered_Architecture]]
- [ ] [[MVC_Pattern]]

#### Modular Monolith & Boundary Rules

- [ ] [[Modular_Monolith_Architecture]]
- [ ] [[Shared_Module_Dependency_Rule]]
- [ ] [[Circular_Dependency]]
- [ ] [[Public_Interface_Pattern]]
- [ ] [[Unified_Fullstack_vs_Split_Architecture]]

#### Design Patterns

- [ ] [[Dependency_Injection]]
- [ ] [[Interface_Driven_Design]]
- [ ] [[Repository_Pattern_vs_Fat_Service]]
- [ ] [[DI_WinForms_Components]]

#### Authentication, Authorization & Web Security Core

- [ ] [[Authentication_JWT_vs_Server_Side_Session]]
- [ ] [[Token_Lifecycle_and_Refresh_Rotation]]
- [ ] [[Role_Based_Access_Control_and_IDOR_Prevention]]
- [ ] [[Web_Security_Core_OWASP_Top_10_Mitigation]]
- [ ] [[CORS_Preflight_and_Same_Origin_Policy]]

#### System Design Frameworks

- [ ] [[System_Design_Architecture_Roadmap]]
- [ ] [[Problem_Driven_System_Design_Framework]]
- [ ] [[Newsfeed_Architecture_Fanout]]

---

### Pillar 3: Database Internals, Storage & Distributed Systems (Layer 3)

#### Database Storage Engine & Physical Layout

- [ ] [[Database_Storage_Pages_and_Buffer_Pool]]
- [ ] [[Postgres_WAL_and_Storage_Engine]]
- [ ] [[Index_BPlusTree]]
- [ ] [[Database_Indexing_Guidelines]]
- [ ] [[Left_Prefix_Index_Postgres]]
- [ ] [[Partial_Index]]
- [ ] [[Prepare_Statements]]
- [ ] [[N_Plus_1_Query_Problem]]
- [ ] [[Postgres_18_New_Features]]
- [ ] [[Timestamp_vs_Timestamptz]]
- [ ] [[Junction_Table]]
- [ ] [[DB_Naming]]
- [ ] [[SQL_Quotes]]

#### Transactions, Isolation & Concurrency Control

- [ ] [[Database_Transaction_Isolation_and_MVCC]]
- [ ] [[Postgres_Select_For_Update_Pessimistic_Locking]]
- [ ] [[Optimistic_Concurrency_Control_Version_Pattern]]
- [ ] [[Redis_Redlock]]

#### In-Memory Systems, Caching Architecture & Invalidation

- [ ] [[RFC_Trending_Cache]]
- [ ] [[Cache_Strategies_Cache_Aside_vs_Write_Through]]
- [ ] [[Cache_Consistency_and_Invalidation_Patterns]]
- [ ] [[Redis_Data_Structures_and_Memory_Optimization]]
- [ ] [[Cache_Stampede_Penetration_Avalanche_Mitigation]]

#### Messaging, Streaming & Reliability Patterns

- [ ] [[Outbox_Pattern]]
- [ ] [[Multi_Layer_Rate_Limiting_DDoS_Prevention]]
- [ ] [[Rate_Limiting_Token_Bucket_and_Sliding_Window]]
- [ ] [[Circuit_Breaker_Pattern]]
- [ ] [[Exponential_Backoff_with_Jitter]]
- [ ] [[Message_Broker_vs_Event_Streaming_Kafka_RabbitMQ]]
- [ ] [[Message_Ordering_and_Exactly_Once_Processing]]

#### Distributed Systems & Consensus

- [ ] [[CAP_Theorem_and_PACELC_Framework]]
- [ ] [[Distributed_Consensus_Raft_and_Paxos]]
- [ ] [[Consistent_Hashing_Distributed_Load_Balancing]]
- [ ] [[Saga_Pattern_Distributed_Transactions]]
- [ ] [[Two_Phase_Commit_Protocol]]

#### API & Pagination Strategies

- [ ] [[API_Versioning_Strategies]]
- [ ] [[Cursor_Pagination]]

#### Benchmarking & Infrastructure Ops

- [ ] [[Postgres_SQL_Performance_Benchmarking_Guide]]
- [ ] [[Go_Benchmarking_and_Allocation_Guide]]
- [ ] [[Local_Stress_Testing_Benchmark]]
- [ ] [[Turborepo]]
- [ ] [[Trust_Proxy_Configuration]]
- [ ] [[Tmux_Session_Window_Pane]]

---

### Pillar 4: Quality, Verification & Full-Stack Observability (Layer 4)

#### Testing Foundations & ISTQB Standards

- [ ] [[7_Principles_of_Testing]]
- [ ] [[Error_Defect_Failure]]
- [ ] [[Test_Case]]
- [ ] [[SDLC_Methodologies_Evolution]]

#### Test Design Techniques

- [ ] [[Black_Box_Testing_Techniques]]
- [ ] [[White_Box_Testing_Techniques]]
- [ ] [[Equivalence_Partitioning]]

#### SDLC Models & Engineering SOPs

- [ ] [[Waterfall]]
- [ ] [[V_Model]]
- [ ] [[Prototype_Model]]
- [ ] [[Spiral_Model]]
- [ ] [[Agile_Scrum]]
- [ ] [[Agile_Management_via_GitHub]]
- [ ] [[Standard_Project_Timeline_SOP]]

#### Automated Verification Frameworks

- [ ] [[Automated_Verification_System_Framework]]
- [ ] [[Test_Driven_Design]]

#### Playwright Protocol-Level Automation Suite

- [ ] [[Browser_Automation_IPC_Fundamentals]]
- [ ] [[Chrome_DevTools_Protocol_Mechanics]]
- [ ] [[WebDriver_vs_CDP_Architectural_Comparison]]
- [ ] [[Browser_Context_Isolation]]
- [ ] [[APIRequestContext_vs_Browser_Engine]]
- [ ] [[RFC_9457_Problem_Details_and_API_Boundary_Testing]]
- [ ] [[Automated_JSON_Schema_and_Contract_Drift_Validation]]
- [ ] [[Asynchronous_Socket_Flooding_and_Race_Condition_Testing]]
- [ ] [[API_Test_Data_Lifecycle_and_State_Isolation]]
- [ ] [[Hybrid_Auth_and_Storage_State_Injection]]
- [ ] [[Role_Based_Locators_and_Accessibility_Tree]]
- [ ] [[Playwright_Auto_Waiting_and_Actionability_Checks]]
- [ ] [[Network_Interception_and_Mocking_Mechanics]]
- [ ] [[Playwright_Trace_Viewer_and_Post_Mortem_Diagnostics]]
- [ ] [[Page_Object_Model_and_Component_Architecture]]
- [ ] [[Service_Object_Model_and_API_Request_Chaining]]

#### Full-Stack Observability & Tracing

- [ ] [[OpenTelemetry_Distributed_Tracing]]
- [ ] [[Prometheus_Metrics_and_Alerting]]

---

## 3. Diagnostic & Root Cause Analysis Toolkit

_Khi hệ thống gặp sự cố (High CPU, Memory Leak, Timeout, Deadlock), tuyệt đối không restart mù quáng. Tuân thủ quy trình truy vết đến tận cùng:_

| Hiện Tượng / Sự Cố                    | Công Cụ Chẩn Đoán Cấp Thấp             | Mục Tiêu Phân Tích                                    | Target Atomic Note                                  |
| :------------------------------------ | :------------------------------------- | :---------------------------------------------------- | :-------------------------------------------------- |
| **High CPU / CPU Spike**              | `pprof`, CPU Profiler, Flamegraphs     | Định vị hàm chiếm dụng chu kỳ CPU cao nhất            | [ ] [[Go_Pprof_and_Flamegraph_Analysis]]            |
| **Memory Leak / OOM**                 | Heap Profiler, Heap Snapshot, GC Trace | Tìm đối tượng không được giải phóng                   | [ ] [[JS_Memory_Leaks_and_Mitigation]]              |
| **Slow I/O / Blocked Thread**         | Linux `strace`, `lsof`                 | Truy vết system call bị nghẽn (`epoll_wait`, `fsync`) | [ ] [[Linux_Strace_and_Syscall_Profiling]]          |
| **Network Latency / Dropped Packets** | `tcpdump`, Wireshark                   | Phân tích TCP Handshake, retransmission, reset        | [ ] [[Network_Packet_Analysis_Tcpdump_Wireshark]]   |
| **Slow Database Queries**             | `EXPLAIN (ANALYZE, BUFFERS)`           | Tìm Seq Scan, Buffer spill to disk, Index misses      | [ ] [[Postgres_SQL_Performance_Benchmarking_Guide]] |

---

## 4. Engineering Craftsmanship & Decision Protocols

1. **KISS & Anti-Overengineering (Keep It Simple, Stupid)**:
   - Tuyệt đối không đưa Microservices, Kafka, hay Kubernetes vào bài toán khi 1 server đơn Postgres + Node.js/Go chưa được tối ưu hóa đến giới hạn.
   - [ ] [[KISS_and_Simplicity_in_System_Design]]
2. **"Show, don't tell" Mindset (Evidence-First)**:
   - Mọi khẳng định kỹ thuật phải được chứng minh bằng Benchmark có số liệu cụ thể ($p95/p99$ Latency, Throughput RPS, Hardware footprint).
   - [ ] [[Local_Stress_Testing_Benchmark]]
3. **Technical Design Documentation (RFC / ADR)**:
   - Trình bày đề xuất kiến trúc rõ ràng: mô tả bài toán, các phương án thay thế, và phân tích sâu các điểm đánh đổi (_Trade-offs_: Consistency vs Latency, Cost vs Velocity).
   - [ ] [[Architecture_Decision_Record_ADR_Standard]]
   - [ ] [[RFC_Design_Document_Framework]]
4. **Open Source & Technical Writing**:
   - Tự tay xây dựng các công cụ thực tế và duy trì thói quen viết Engineering Post-mortems và Code Walkthroughs.
   - [ ] [[Open_Source_Contribution_and_Tooling_Guide]]
   - [ ] [[Engineering_Post_Mortem_Writing_Guide]]

5. **AI-as-Mentor Protocol (Cognitive Ownership & Active Coding)**:
   - Tuân thủ [[RMIT_Critical_Review_AI_Coding_2026]] (Phase 1: System Fundamentals): Tuyệt đối không copy-paste code do AI sinh sẵn cho các thuật toán, concurrency logic, hay core business rules.
   - **Phân định vai trò:**
     - **AI đóng vai trò:** Socratic Tutor (gợi mở tư duy, giải thích under-the-hood, chỉ ra edge-cases, cung cấp tài liệu uy tín, và review phản biện logic).
     - **Human đóng vai trò:** Author & Implementer (tự tay tư duy thuật toán, tự gõ từng dòng code thực nghiệm, tự debug qua compiler/runtime errors).
   - **Mục tiêu:** Xây dựng Mental Model nguyên bản và Technical Judgment thực chất. Chỉ chuyển sang AI-Orchestration khi đã làm chủ hoàn toàn các System Invariants.

---

## 5. Definition of Done (Tiêu Chuẩn Đóng Gói Tri Thức)

Một chủ đề hoặc tính năng chỉ được đánh dấu `[x]` khi thỏa mãn đồng thời 4 điều kiện:

1. **Codebase Execution**: Triển khai trực tiếp trên mã nguồn thật hoặc tái hiện qua bài test thực tế (Unit/Integration/Repro Script), vượt qua 100% test suites, không có lỗi tiềm ẩn.
2. **Empirical Measurement**: Đo đạc được số liệu thực tế (`p95/p99 Latency`, `Throughput RPS`, `Memory/CPU Footprint`, `EXPLAIN (ANALYZE, BUFFERS)`).
3. **Atomic Synthesis**: Tạo hoặc cập nhật Atomic Note chuẩn cấu trúc đúc kết nguyên lý under the hood và các điểm đánh đổi (_Trade-offs_).
4. **Active Flashcard Minted**: Bắt buộc tạo ít nhất 1–2 thẻ câu hỏi chẩn đoán (Diagnostic Cards) trong thư mục `50_Flashcards/` tương ứng và đồng bộ vào Anki để kích hoạt vòng lặp Spaced Repetition trước khi được phép tích `[x]`.

---

## Related Notes

- [[System_Design_Architecture_Roadmap]]
- [[Problem_Driven_System_Design_Framework]]
- [[Postgres_SQL_Performance_Benchmarking_Guide]]
- [[Automated_Verification_System_Framework]]
- [[Data_Structures_and_Algorithms_Roadmap]]
- [[English_Learner_Profile]]
- [[00_Dashboard]]
- [[000_Methods_MOC]]
- [[000_Tech_MOC]]
