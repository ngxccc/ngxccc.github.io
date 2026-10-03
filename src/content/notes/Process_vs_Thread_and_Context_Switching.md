---
title: "Process vs Thread and Context Switching"
description: "Nguyên lý tầng sâu của Hệ điều hành về Tiến trình (Process), Luồng (Thread), mô hình bộ nhớ Virtual Memory Space, PCB/TCB, và chi phí phần cứng của Context Switching (CPU Registers, Cache, TLB)."
date: "2026-09-22"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/Process_vs_Thread_and_Context_Switching.md"
---
# Process vs Thread and Context Switching

## TL;DR

- **Bản chất**: **Process** là đơn vị cấp phát tài nguyên độc lập của Operating System (sở hữu riêng Virtual Memory Space, Page Table, File Descriptors, PCB). **Thread** là đơn vị thực thi mã độc lập bên trong Process (dùng chung Text, Data, Heap nhưng có Stack và Register State riêng).
- **Mục đích**: Process cung cấp Isolation và an toàn bộ nhớ tuyệt đối; Thread cung cấp Lightweight Concurrency và chia sẻ dữ liệu tốc độ cao không cần IPC.
- **Điểm mấu chốt**: **Context Switch giữa 2 Process** đắt đỏ (~1,000–3,000 ns) vì phải đổi con trỏ Page Table trong thanh ghi CR3, làm mất hiệu lực (invalidate) **TLB (Translation Lookaside Buffer)** và gây Cold CPU Cache. **Context Switch giữa 2 Thread trong cùng Process** rẻ hơn (~500–1,000 ns) vì giữ nguyên Page Table. **Goroutine switch** chỉ tốn ~10–100 ns vì diễn ra hoàn toàn ở User Space mà không bẫy vào Kernel.

---

## Core Concept

### 1. Phân tích Cấu trúc Bộ nhớ: Process vs Thread

#### A. Góc nhìn Logic & Sở hữu Tài nguyên (Logical / Resource Ownership View)

```
+-------------------------------------------------------------------+
|                        PROCESS MEMORY SPACE                       |
|                                                                   |
|  +--------------------+  +--------------------+  +-------------+  |
|  |    Text Segment    |  |    Data Segment    |  |    Heap     |  |
|  |   (Machine Code)   |  |  (Global Variables)|  | (Dynamic Alloc)|  |
|  +--------------------+  +--------------------+  +-------------+  |
|          ^                         ^                    ^         |
|          |                         |                    |         |
|     (SHARED)                  (SHARED)             (SHARED)   |
|          |                         |                    |         |
|  +-------+-------------------------+--------------------+------+  |
|  |                                                             |  |
|  |   +-----------------------+     +-----------------------+   |  |
|  |   |       THREAD 1        |     |       THREAD 2        |   |  |
|  |   |  - Private Stack      |     |  - Private Stack      |   |  |
|  |   |  - Registers (PC, SP) |     |  - Registers (PC, SP) |   |  |
|  |   |  - TCB (Thread State) |     |  - TCB (Thread State) |   |  |
|  |   +-----------------------+     +-----------------------+   |  |
|  +-------------------------------------------------------------+  |
+-------------------------------------------------------------------+
```

#### B. Góc nhìn Bố cục Không gian Địa chỉ RAM Ảo (Virtual Address Space Layout)

```
High Memory Address
+-------------------------------------------------------------+
| KERNEL SPACE (Dành riêng cho Kernel khi bẫy System Call)    |
+-------------------------------------------------------------+
| STACK (Phát triển đi XUỐNG vvv)                             |
|  - Stack của Thread 1 (Local variables, Stack Frames)       |
|  - Stack của Thread 2 (Local variables, Stack Frames)       |
+-------------------------------------------------------------+
|                          ...                                |
|             (Unallocated Free Memory Gap)                   |
|                          ...                                |
+-------------------------------------------------------------+
| HEAP (Phát triển đi LÊN ^^^)                                |
|  - Dynamic memory allocation (malloc, new, pointer)         |
|  - SHARED: Mọi Thread trong Process đều đọc/ghi vào đây     |
+-------------------------------------------------------------+
| BSS & DATA SEGMENT                                          |
|  - Global variables và Static variables                     |
|  - SHARED: Mọi Thread trong Process đều đọc/ghi vào đây     |
+-------------------------------------------------------------+
| TEXT / CODE SEGMENT (Read-Only)                             |
|  - Binary machine code (CPU instructions)                   |
|  - SHARED: Tất cả Thread cùng đọc chung mã này              |
+-------------------------------------------------------------+
Low Memory Address
```

#### C. Process (Đơn vị cấp phát tài nguyên)

- **Tài nguyên độc lập**: Mỗi Process có một bảng phân trang riêng (**Page Table**) ánh xạ không gian địa chỉ ảo (Virtual Memory) vào RAM vật lý. Process A **không thể đọc hoặc ghi** vào bộ nhớ của Process B (bị phần cứng MMU chặn và kích hoạt `Segmentation Fault` nếu cố truy cập).
- **Cấu trúc quản lý**: Hệ điều hành quản lý Process thông qua **PCB (Process Control Block)** gồm: Process ID (PID), Trạng thái (Ready/Running/Waiting), Con trỏ Page Table, File Descriptors, Permissions.

#### D. Thread (Đơn vị điều phối thực thi)

- **Tài nguyên dùng chung**: Mọi Thread trong cùng một Process đều dùng chung Text Segment, Data/BSS Segment, Heap, và File Descriptors.
- **Thread-private**:
  1. **Stack**: Lưu biến cục bộ và Stack Frames của riêng Thread đó.
  2. **Registers & Program Counter (PC)**: Lưu trạng thái CPU tức thời (Thread đang thực thi đến lệnh máy nào).
- **Cấu trúc quản lý**: Hệ điều hành quản lý Thread thông qua **TCB (Thread Control Block)** gồm: Thread ID (TID), Register Set, Stack Pointer, Con trỏ trỏ về PCB cha.

---

### 2. Bản chất Cơ học của Context Switching

**Context Switching** là quá trình CPU dừng thực thi một Thread/Process để chuyển sang thực thi Thread/Process khác khi hết Time Slice hoặc khi gặp I/O Blocking.

```
[Running: Thread 1] ──> [Interrupt/System Call] ──> [Save TCB 1]
                                                          │
[Restore TCB 2] <── [Select Thread 2 (OS Scheduler)] <────┘
      │
      └──> [Running: Thread 2]
```

#### Ba Cấp độ Chi phí của Context Switch:

| Cấp độ                                         | Thao tác phần cứng / Hệ điều hành                                         | Chi phí thời gian    | Nguyên nhân tốn chi phí                                                                                                |
| :--------------------------------------------- | :------------------------------------------------------------------------ | :------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **1. Process Switch** (Nặng nhất)              | Đổi PCB, lưu thanh ghi, ghi đè thanh ghi **CR3** để đổi Page Table.       | **1,000 – 3,000 ns** | **TLB Invalidation**: Toàn bộ bộ nhớ đệm dịch địa chỉ bị vô hiệu hóa; gây CPU Cache Miss hàng loạt (Cold Cache).       |
| **2. Kernel Thread Switch** (Trung bình)       | Đổi TCB, lưu/khôi phục CPU Registers (PC, SP, FP). Giữ nguyên Page Table. | **500 – 1,000 ns**   | Bẫy vào Kernel Space (Ring 0), nhưng giữ lại được TLB mapping và CPU L1/L2 Cache ấm.                                   |
| **3. Goroutine / Coroutine Switch** (Siêu nhẹ) | Đổi context ở User Space thông qua Go Runtime Scheduler (M:N model).      | **10 – 100 ns**      | **Hoàn toàn ở User-space**, không chuyển đổi Ring 0/Ring 3, chỉ lưu 3 thanh ghi (PC, SP, DX), Stack siêu nhỏ (từ 2KB). |

---

### 3. Ma trận Đánh đổi Thiết kế Kiến trúc (Trade-off Matrix)

| Tiêu chí                                      | Multi-Process (Ví dụ: Nginx, Chrome, PostgreSQL)                                                     | Multi-Thread (Ví dụ: Java Netty, Go Runtime, Node Worker)                                                 |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Tính cô lập & Chống sập (Fault Isolation)** | **Tuyệt đối**: Một Worker process bị crash/panic không làm sập các process khác.                     | **Thấp**: Một Thread bị Panic/Segfault không bắt được có thể làm sập toàn bộ Process.                     |
| **Chia sẻ dữ liệu**                           | Phức tạp, phải dùng IPC (Inter-Process Communication: Sockets, Pipes, Shared Memory, Message Queue). | Cực kỳ nhanh, chỉ cần đọc/ghi chung con trỏ trên Heap.                                                    |
| **Rủi ro Đồng thời (Concurrency Bug)**        | Không có Race Condition trên bộ nhớ nội bộ.                                                          | Rất dễ dính **Race Condition, Deadlock, Memory Visibility**. Bắt buộc dùng Mutex, Semaphore, hoặc Atomic. |
| **Chi phí RAM & CPU Overhead**                | Tốn nhiều RAM do nhân bản Page Table và các cấu trúc OS.                                             | Tiết kiệm RAM, tạo và hủy luồng nhanh hơn nhiều.                                                          |

---

## Practical Implementation

### Mô hình 3 bước kiểm chứng trong Go

1. **Kiểm chứng Process Isolation**: Tạo Process con qua `os/exec`. Thay đổi biến toàn cục ở con $\rightarrow$ Không gian bộ nhớ của cha không đổi.
2. **Kiểm chứng Thread Memory Sharing**: Chạy 4 Goroutines cùng `counter++` không dùng lock $\rightarrow$ Race Condition chứng minh dữ liệu bị ghi đè do dùng chung Heap.
3. **Kiểm chứng Context Switch**: Dùng Ping-Pong Unbuffered Channel để đo latency chuyển đổi ngữ cảnh siêu nhỏ của User-space Threading (Goroutine) so với OS Kernel Thread.

---

## Related Notes

- [[Stack_vs_Heap_Memory_Fundamentals]]: Cơ chế phân bổ bộ nhớ Stack và Heap.
- [[Master_Backend_Engineering_SSOT]]: Khung chương trình và bản đồ thực hành Backend.
- [[000_Concepts_MOC]]: Danh mục lý thuyết nền tảng khoa học máy tính.
