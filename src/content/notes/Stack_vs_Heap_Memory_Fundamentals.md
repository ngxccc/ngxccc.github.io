---
title: "Stack vs Heap Memory Fundamentals"
description: "Nguyên lý khoa học máy tính cốt lõi của bộ nhớ Stack (LIFO, CPU Stack Pointer) và Heap (Dynamic Memory Allocation, OS Virtual Memory)."
date: "2026-08-09"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/Stack_vs_Heap_Memory_Fundamentals.md"
---
## TL;DR

- **Bản chất**: Stack là cơ chế quản lý phần cứng trực tiếp bằng thanh ghi CPU Stack Pointer theo nguyên lý LIFO; Heap là vùng nhớ cấp phát động quản lý bằng phần mềm qua OS Virtual Memory và Runtime Memory Allocator.
- **Mục đích**: Stack phục vụ lưu trữ ngữ cảnh thực thi hàm và biến cục bộ ngắn hạn với tốc độ tối đa; Heap lưu trữ các đối tượng có kích thước linh hoạt, con trỏ chia sẻ trạng thái, hoặc tuổi thọ vượt ra ngoài phạm vi một hàm.
- **Điểm mấu chốt**: Cấp phát và thu hồi trên Stack tốn chi phí $O(1)$ chỉ bằng 1 phép tính số học trên thanh ghi CPU (như `SUB/ADD RSP`) và không gây áp lực lên Garbage Collector; ngược lại Heap tốn chi phí tra cứu ô nhớ trống và kích hoạt chu kỳ dọn rác (GC overhead qua `runtime.newobject`).

---

## Core Concept

### 1. Cơ chế Phần cứng của STACK (Ngăn xếp)

- **Thanh ghi CPU điều khiển:**
  - `RSP` (Stack Pointer trên kiến trúc x86_64): Lưu địa chỉ đỉnh hiện tại của Stack.
  - `RAX` (Accumulator Register): Lưu trữ giá trị trả về (`return value`) của hàm để caller nhận trực tiếp từ thanh ghi siêu tốc mà không cần qua RAM.
- **Stack Frame (Khung ngăn xếp):** Mỗi hàm khi được gọi sẽ tạo một Stack Frame độc lập ngăn cách với các hàm khác, chứa địa chỉ trả về (Return Address) và các biến cục bộ.
- **Cấp phát & Thu hồi cực nhanh:**
  - Cấp phát chỉ tốn đúng 1 lệnh máy CPU: trừ giá trị con trỏ Stack Pointer (ví dụ: `SUB RSP, 32` để kéo đỉnh stack xuống dành 32 bytes).
  - Khi hàm kết thúc, CPU cộng trả lại giá trị con trỏ (`ADD RSP, 32`). Toàn bộ biến cục bộ bị huỷ bỏ tức thì trong 1 chu kỳ xung nhịp ($O(1)$).
- **Tính chất vật lý:** Vùng nhớ Stack liên tục (Contiguous Memory), nằm gọn trong các tầng CPU Cache (L1/L2) nên tốc độ truy xuất đạt tối đa (độ trễ ~1 nano giây).
- **Giới hạn:** Kích thước cố định (Thread OS thường từ 1MB đến 8MB; Go Goroutine khởi tạo từ 2KB và mở rộng động). Khi gọi đệ quy vô hạn hoặc vượt quá giới hạn, hệ thống ném ra lỗi **Stack Overflow**.

### 2. Cơ chế Phần mềm của HEAP (Vùng nhớ Cấp phát Động)

- **Quản lý bằng phần mềm:** Không có phần cứng nào tự động quản lý Heap. Nhiệm vụ này thuộc về **Runtime Memory Allocator** (như `malloc` trong C, Allocator của Go Runtime, hoặc V8 trong Node.js) phối hợp cùng bộ quản lý bộ nhớ ảo của Hệ điều hành (OS Virtual Memory).
- **Quy trình cấp phát:**
  - Hệ thống phải tra cứu qua danh sách các khối nhớ trống (Free List, Size Classes) để tìm vùng nhớ liên tục vừa vặn với kích thước yêu cầu.
  - Trong môi trường đa luồng (Multi-threading), các luồng phải đồng bộ qua khóa (Lock) hoặc Thread-Local Cache để tránh xung đột ghi đè.
- **Tuổi thọ & Rủi ro:**
  - Dữ liệu trên Heap không tự mất đi khi hàm kết thúc. Nó tồn tại độc lập cho đến khi lập trình viên tự giải phóng (C/C++) hoặc chờ Garbage Collector (GC) quét qua và thu hồi.
  - Cấp phát quá nhiều trên Heap dẫn đến phân mảnh bộ nhớ (Memory Fragmentation), kéo dài thời gian dừng của GC (GC Pause/Latency Spikes) và nguy cơ tràn RAM (**Out of Memory - OOM**).

---

## Practical Implementation

### Mô hình 2 bước kiểm chứng Escape Analysis trong Go

1. **Kiểm chứng Escape Decision (`go build -gcflags="-m"`):**
   - Hàm trả về giá trị (`return x`): Compiler giữ biến `x` 100% trên Stack vì chỉ cần copy giá trị qua thanh ghi CPU.
   - Hàm trả về con trỏ (`return &x`): Compiler đưa ra quyết định `moved to heap: x` để tránh lỗi Dangling Pointer khi Stack Frame bị hủy.
2. **Kiểm chứng Machine Assembly (`go tool compile -l -S`):**
   - Hàm trên Stack: Không có bất kỳ lời gọi cấp phát nào.
   - Hàm trên Heap: Xuất hiện chỉ thị `CALL runtime.newobject(SB)` chứng minh Runtime phải cấp phát ô nhớ động trên RAM.

---

## Related Notes

- [[Garbage_Collection_Fundamentals]]
- [[Memory_Leaks_Core_Mechanics]]
- [[Heap_Memory_Size_Classes_and_Alignment]]
- [[Go_Escape_Analysis_Mechanics]]
- [[JS_Stack_vs_Heap_Memory]]
- [[000_Concepts_MOC]]
