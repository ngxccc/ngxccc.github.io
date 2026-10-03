---
title: "N Plus One Query Optimization via In-Memory Hash Map"
description: "Nguyên lý loại bỏ vấn nạn N+1 Database Query bằng kỹ thuật Batching với inArray kết hợp In-Memory Hash Map, giảm số lượng Network Round-trips từ 2N+1 xuống 3 truy vấn song song cố định O(1)."
date: "2026-09-22"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/N_Plus_One_Query_Optimization_via_In_Memory_Hash_Map.md"
---
## TL;DR

- **Bản chất**: Vấn nạn **$N+1$ Query** xảy ra khi truy vấn 1 danh sách gồm $N$ phần tử cha, sau đó với mỗi phần tử cha lại thực hiện thêm 1 (hoặc 2) câu truy vấn độc lập xuống Database để lấy quan hệ con (`quote_items`, `users`).
- **Hậu quả**: Nếu lấy $N = 20$ báo giá, hệ thống phải thực hiện $2N + 1 = 41$ lượt round-trips qua mạng tới PostgreSQL, gây nghẽn kết nối và tăng p95 latency.
- **Giải pháp tối ưu**:
  1. Gom toàn bộ danh sách ID: `quoteIds` và `userIds`.
  2. Bắn **3 truy vấn cố định**: (1) Lấy danh sách Quotes, (2) Lấy `quote_items` bằng `WHERE quote_id IN (...)`, (3) Lấy `users` bằng `WHERE id IN (...)` chạy song song qua `Promise.all()`.
  3. Ghép nối dữ liệu trong RAM bằng **In-Memory Hash Map (`new Map()`)** với độ phức tạp thời gian tra cứu $O(1)$.

---

## Core Concept

### 1. So sánh Cơ chế: Ngây thơ ($2N+1$) vs Batching Hash Map (3 Queries)

```
CÁCH NGÂY THƠ (2N + 1 ROUND-TRIPS):
[Client] ──> Query 1: SELECT * FROM quotes LIMIT 20
         ──> Query 2: SELECT * FROM quote_items WHERE quote_id = Q1
         ──> Query 3: SELECT * FROM users WHERE id = U1
         ──> Query 4: SELECT * FROM quote_items WHERE quote_id = Q2
         ──> Query 5: SELECT * FROM users WHERE id = U2
         ... (Lặp lại 2N lần -> 41 Network Round-trips!)

CÁCH TỐI ƯU (IN-MEMORY HASH MAP BATCH JOIN - 3 QUERIES):
[Client] ──> Query 1: SELECT * FROM quotes LIMIT 20
         │
         ├──> Gom danh sách quoteIds = [Q1, Q2, ..., Q20]
         ├──> Gom danh sách userIds  = [U1, U2, ..., U15]
         │
         ├──> [Promise.all Song song]:
         │     ├──> Query 2: SELECT * FROM quote_items WHERE quote_id IN (Q1..Q20)
         │     └──> Query 3: SELECT * FROM users WHERE id IN (U1..U15)
         │
         └──> [Node.js RAM]:
               - Map<quoteId, items[]>: Hash Map phân nhóm O(1)
               - Map<userId, user>:     Hash Map tra cứu O(1)
               - Duyệt 1 vòng O(N) map kết quả trả về!
```

---

### 2. Tại sao không dùng SQL `LEFT JOIN` khổng lồ cho tất cả?

Nhiều người nghĩ: _"Tại sao không `LEFT JOIN` bảng `quotes`, `quote_items` và `users` vào 1 câu truy vấn duy nhất?"_

- **Bẫy Cartesian Product (Nhân bản dòng dữ liệu)**:
  - Nếu 1 Báo giá có 10 items, phép `LEFT JOIN` sẽ nhân bản toàn bộ thông tin của Quote (customerName, shippingAddress, terms) lặp lại **10 lần** trên mạng.
  - Khi có $N = 20$ Quotes, DB phải serialize và gửi qua mạng hàng trăm dòng dữ liệu trùng lặp $\rightarrow$ Tốn băng thông I/O và ngốn CPU giải mã.
  - Phá vỡ cấu trúc phân trang chuẩn `LIMIT / OFFSET` trên bảng cha.
- **Tách thành 3 Fixed Queries**:
  - Giữ số lượng byte truyền tải trên mạng ở mức tối thiểu tuyệt đối.
  - Phân trang `LIMIT/OFFSET` trên bảng `quotes` chính xác 100%.

---

## Practical Implementation

### Đoạn mã thực tế từ `quotes.service.ts`

```typescript
// 1. Query 1: Lấy danh sách Quotes chính xác theo Pagination
const quoteRecords = await this.db
  .select()
  .from(quotes)
  .limit(limit)
  .offset(offset);
if (quoteRecords.length === 0) return { items: [], meta };

const quoteIds = quoteRecords.map((q) => q.id);
const userIds = [...new Set(quoteRecords.map((q) => q.userId).filter(Boolean))];

// 2. Query 2 & 3: Batch query song song qua Promise.all()
const [allItemRecords, allUsers] = await Promise.all([
  this.db
    .select({ item: quoteItems, product: products })
    .from(quoteItems)
    .leftJoin(products, eq(quoteItems.productId, products.id))
    .where(inArray(quoteItems.quoteId, quoteIds)), // WHERE quote_id IN (...)

  userIds.length > 0
    ? this.db.select().from(users).where(inArray(users.id, userIds))
    : Promise.resolve([]),
]);

// 3. Xây dựng Hash Map trong RAM (O(M + K))
const itemsByQuoteId = new Map<string, ItemWithProduct[]>();
for (const { item, product } of allItemRecords) {
  const list = itemsByQuoteId.get(item.quoteId) ?? [];
  list.push({ ...item, product });
  itemsByQuoteId.set(item.quoteId, list);
}

const usersById = new Map<string, User>();
for (const u of allUsers) {
  usersById.set(u.id, u);
}

// 4. Ghép nối kết quả với thời gian tra cứu O(1)
const items = quoteRecords.map((quote) => ({
  ...quote,
  items: itemsByQuoteId.get(quote.id) ?? [],
  user: quote.userId ? (usersById.get(quote.userId) ?? null) : null,
}));
```

---

## Related Notes

- [[Finite_State_Machine_and_Concurrency_Guard]]: Kiến trúc FSM và bảo vệ giao dịch Báo giá.
- [[Postgres_Select_For_Update_Pessimistic_Locking]]: Cơ chế khóa và tối ưu hóa truy vấn Database.
- [[000_Concepts_MOC]]: Danh mục lý thuyết nền tảng khoa học máy tính.
