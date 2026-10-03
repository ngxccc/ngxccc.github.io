---
title: "Redis Single Threaded Event Loop Architecture"
description: "Bản chất kiến trúc Single-threaded Event Loop của Redis: phân tách Network Layer qua I/O Multiplexing epoll/kqueue và Execution Layer tuần tự trên RAM, nguyên nhân Head-of-Line Blocking từ các lệnh O(N)."
date: "2026-10-02"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/Redis_Single_Threaded_Event_Loop_Architecture.md"
---
# Redis Single Threaded Event Loop Architecture

## TL;DR

- **Bản chất**: **Redis** vận hành dựa trên kiến trúc **Reactor Pattern**: tách bạch tầng Network I/O xử lý hàng chục ngàn kết nối đồng thời qua cơ chế **I/O Multiplexing** (`epoll`/`kqueue` của OS Kernel) và tầng Execution xử lý tuần tự từng Command trên đúng **1 luồng chính duy nhất** (Single Execution Thread).
- **Mục đích**: Loại bỏ hoàn toàn chi phí **Thread Context Switch**, triệt tiêu tranh chấp khóa (**Lock Contention**, không dùng Mutex/Spinlock trên dữ liệu), và tối đa hóa **CPU Cache Locality** (L1/L2/L3) khi thao tác trực tiếp trên RAM ở tốc độ sub-microsecond.
- **Điểm mấu chốt**: Vì Command Engine là Single-threaded tuần tự, bất kỳ lệnh nào có Time Complexity $O(N)$ (như `KEYS *`, `HGETALL` lớn) sẽ gây ra **Head-of-Line Blocking**, đóng băng toàn bộ Event Loop và khiến mọi Client khác bị kẹt độ trễ (Latency Spike) nghiêm trọng.

---

## Kiến trúc Tổng quan (System Overview)

![[30_Resources/Excalidraw/redis_event_loop_architecture.svg]]

Kiến trúc bên trong tiến trình `redis-server` được chia thành 2 phân tầng tách biệt:

1. **Network Layer (Kernel I/O Multiplexing)**: Quản lý hàng chục ngàn Socket connections qua File Descriptors (FD).
2. **Execution Layer (Redis Engine while(1) Loop)**: Vòng lặp `aeMain` rút từng Command từ Fired Events Queue và thực thi trực tiếp trên In-Memory Dict.

---

## Core Mechanics

### 1. Network Layer: I/O Multiplexing với `epoll` / `kqueue`

![[30_Resources/Excalidraw/redis_network_epoll_layer.svg]]

Trong mô hình mạng truyền thống (Multi-threaded Blocking I/O):

- Mỗi Client kết nối tới Server đòi hỏi 1 Thread riêng biệt.
- Với 10,000 Clients đồng thời, Server cần 10,000 Threads $\rightarrow$ Hầu hết Threads ở trạng thái Idle chờ gói tin, tiêu tốn hàng Gigabyte RAM cho Stack bộ nhớ và làm tê liệt CPU vì **Thread Context Switching**.

Redis giải quyết bài toán này bằng **I/O Multiplexing**:

- Mọi kết nối Client từ Backend App (Node.js, Go, Java, .NET) tới Redis port 6379 là một **TCP Socket Connection**. Ở tầng Linux Kernel, mỗi kết nối được định danh bằng một số nguyên gọi là **File Descriptor (FD)**.
- Thay vì tự theo dõi, Redis đăng ký toàn bộ danh sách FDs này vào hệ thống thông báo sự kiện của Kernel (`epoll` trên Linux, `kqueue` trên macOS/BSD).
- Hàm `epoll_wait()` đưa luồng của Redis vào trạng thái ngủ khi không có dữ liệu. Ngay khi có Network Packet đến một hoặc nhiều Socket (ví dụ Client #1 gửi chuỗi lệnh `GET user:1`), phần cứng kích hoạt ngắt (Hardware Interrupt), Kernel đánh thức Redis và trả về chính xác danh sách **Fired Events** chứa các FDs có dữ liệu sẵn sàng để đọc trong thời gian $O(1)$.
- **Kết quả**: 1 luồng duy nhất quản lý hơn 100,000 kết nối nhàn rỗi với $0\%$ CPU overhead.

> **Lưu ý về Multi-threaded I/O (Redis 6.0+)**:
> Từ bản 6.0, Redis bổ sung `io-threads` để đọc raw bytes từ Socket Buffer, giải mã giao thức RESP (Redis Serialization Protocol), và ghi dữ liệu phản hồi trả về Client song song trên nhiều Threads. Tuy nhiên, **khâu thực thi Command Logic vẫn hoàn toàn là Single-threaded**.

---

### 2. Execution Layer: Vòng lặp `aeMain` và Trực tiếp thao tác RAM

![[30_Resources/Excalidraw/redis_execution_event_loop_layer.svg]]

Trái tim của Redis Engine là một vòng lặp vô tận viết bằng ngôn ngữ C trong file `ae.c`:

```c
void aeMain(aeEventLoop *eventLoop) {
    eventLoop->stop = 0;
    while (!eventLoop->stop) {
        // 1. Chặn tại epoll_wait cho đến khi có Socket sẵn sàng hoặc Timer hết hạn
        aeProcessEvents(eventLoop, AE_ALL_EVENTS|AE_CALL_BEFORE_SLEEP|AE_CALL_AFTER_SLEEP);
    }
}
```

Khi `aeProcessEvents` nhận được danh sách các FDs có dữ liệu, luồng chính duyệt qua từng Event theo thứ tự FIFO (First-In, First-Out):

```
Fired Events: [FD 104] ──► [FD 105] ──► [FD 108] ──► [FD 9942]
                   │
                   ▼ (Tuần tự thực thi từng Command)
          processCommand(client)
                   │
                   ▼ (Thao tác RAM Dict ~50 nanoseconds)
          addReply(client)
```

Mỗi thao tác `processCommand` chỉ tác động lên cấu trúc dữ liệu con trỏ trên RAM (`dict.c`):

- `GET / SET`: Thao tác trên Hash Table với Time Complexity trung bình $O(1)$ (~50 nano-giây).
- Không có bất kỳ Disk I/O nào cản trở luồng thực thi trong quá trình xử lý lệnh.
- Không tồn tại Mutex Locks hay Spinlocks: Không xảy ra hiện tượng **Lock Contention** hay **Deadlock** giữa các luồng.

---

### 3. Nguy cơ Head-of-Line Blocking từ các Lệnh $O(N)$

Vì toàn bộ Command được thực thi trên một đường ray duy nhất (Single Timeline):

$$\text{Total Latency} = \text{Queue Wait Time} + \text{Execution Time} + \text{Network RTT}$$

Nếu Client #3 phát lệnh `KEYS *` trên cơ sở dữ liệu có $1,000,000$ Keys:

- Quá trình quét toàn bộ Buckets trong RAM tốn khoảng $850\text{ ms}$ thời gian CPU của luồng chính.
- Trong suốt $850\text{ ms}$ này, vòng lặp `while(!stop)` bị giữ chặt tại `processCommand` của Client #3.
- Toàn bộ các yêu cầu cực nhẹ của Client khác (ví dụ `GET user:1` chỉ mất 50ns) đến sau trong Fired Events Queue đều phải chịu **Queue Wait Time** $\ge 850\text{ ms}$. Hiện tượng này gọi là **Head-of-Line Blocking**.

---

## Rules: Kỷ luật Non-blocking trên Production

Để bảo vệ Event Loop, mọi thao tác có Time Complexity phụ thuộc vào quy mô dữ liệu $O(N)$ đều phải được chuyển đổi sang cơ chế Non-blocking:

| Lệnh gây nghẽn ($O(N)$ Blocker) | Rủi ro kỹ thuật                                                                      | Lệnh thay thế Non-blocking chuẩn       | Cơ chế khắc phục                                                                                                                    |
| :------------------------------ | :----------------------------------------------------------------------------------- | :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `KEYS *`                        | Duyệt toàn bộ Keyspace, chiếm dụng CPU từ vài trăm ms đến vài chục giây.             | `SCAN cursor MATCH pattern* COUNT 100` | Duyệt qua con trỏ trạng thái (Cursor-based Iterator). Mỗi lần gọi chỉ quét 1 lượng Buckets cố định rồi nhả CPU cho các Events khác. |
| `DEL <large_key>`               | Giải phóng đồng bộ hàng trăm ngàn phần tử trong Hash/Set/List, làm đứng luồng chính. | `UNLINK <large_key>`                   | Tách Key khỏi Keyspace trong $O(1)$ và đẩy tiến trình `free` bộ nhớ cho luồng ngầm (`bio.c` - `bio_lazy_free`) xử lý bất đồng bộ.   |
| `HGETALL <large_hash>`          | Đọc toàn bộ Field-Value, chiếm dụng băng thông mạng và Event Loop.                   | `HSCAN <key> cursor` hoặc `HMGET`      | Đọc dữ liệu theo từng Batch nhỏ.                                                                                                    |
| `SMEMBERS <large_set>`          | Trả về toàn bộ tập hợp, gây chậm trễ tuyến tính theo kích thước Set.                 | `SSCAN <key> cursor`                   | Đọc theo phân trang Cursor.                                                                                                         |
| `FLUSHALL` / `FLUSHDB`          | Xóa sạch toàn bộ dữ liệu trên toàn bộ DB một cách đồng bộ.                           | `FLUSHALL ASYNC` / `FLUSHDB ASYNC`     | Đẩy việc thu hồi vùng nhớ toàn cục cho Background Thread.                                                                           |

---

## Pseudo-code Minh họa Cơ chế Engine

Mô hình hóa tư duy mã nguồn C của `redis-server` sang TypeScript:

```typescript
// Mô hình hóa tư duy cho kiến trúc Reactor Pattern của Redis
interface FiredEvent {
  fd: number;
  mask: "READABLE" | "WRITABLE";
}

class RedisServerEngine {
  private inMemoryDict = new Map<string, any>();
  private isRunning = true;

  public async runEventLoop(): Promise<void> {
    while (this.isRunning) {
      // TẦNG 1: NETWORK I/O MULTIPLEXING (epoll_wait)
      // Luồng đi ngủ cho đến khi Kernel báo có dữ liệu ở Socket
      const firedEvents: FiredEvent[] = await this.epollWait();

      // TẦNG 2: EXECUTION LAYER (Single Main Thread)
      // Tuần tự thực thi từng câu lệnh trong danh sách
      for (const event of firedEvents) {
        const rawBytes = this.readSocketBuffer(event.fd);
        const command = this.parseRESPProtocol(rawBytes);

        // THỰC THI TRỰC TIẾP TRÊN RAM (Sub-microsecond)
        // CẢNH BÁO: Nếu hàm này tốn 500ms, toàn bộ vòng lặp for bị treo!
        const response = this.processCommand(command);

        this.writeSocketBuffer(event.fd, response);
      }
    }
  }

  private processCommand(cmd: { name: string; args: string[] }): any {
    switch (cmd.name.toUpperCase()) {
      case "GET":
        return this.inMemoryDict.get(cmd.args[0]) ?? null; // O(1) in RAM
      case "SET":
        this.inMemoryDict.set(cmd.args[0], cmd.args[1]); // O(1) in RAM
        return "OK";
      case "KEYS":
        // NGUY HIỂM: O(N) Scan toàn bộ Map làm đóng băng toàn bộ Event Loop
        return Array.from(this.inMemoryDict.keys());
      default:
        throw new Error("Unknown Command");
    }
  }

  private async epollWait(): Promise<FiredEvent[]> {
    // Gọi xuống syscall epoll_wait(epfd, events, max, timeout) của Linux Kernel
    return [];
  }

  private readSocketBuffer(fd: number): Buffer {
    return Buffer.alloc(0);
  }

  private parseRESPProtocol(buf: Buffer): { name: string; args: string[] } {
    return { name: "GET", args: ["user:1"] };
  }

  private writeSocketBuffer(fd: number, data: any): void {}
}
```

---

## Related Notes

- [[Process_vs_Thread_and_Context_Switching]]: Bản chất chi phí chuyển đổi ngữ cảnh và tài nguyên Thread.
- [[Latency_Percentiles_and_Throughput_Fundamentals]]: Phân tích hiện tượng Tail Latency và Coordinated Omission khi hàng đợi bị nghẽn.
- [[000_Concepts_MOC]]: Danh mục tri thức nền tảng Khoa học Máy tính.
