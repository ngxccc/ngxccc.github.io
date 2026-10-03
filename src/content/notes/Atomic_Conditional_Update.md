---
title: "Atomic Conditional Update"
description: "Cơ chế cập nhật nguyên tử có điều kiện trong Database để triệt tiêu Race Condition mà không cần giữ khóa giao dịch dài."
date: "2026-09-16"
tags: ["type/concept", "status/permanent"]
aliases: ["Atomic Update", "Conditional Update", "Compare-and-Swap SQL"]
domain: "Engineering"
sourcePath: "30_Resources/Tech/API_and_Data_Design/Atomic_Conditional_Update.md"
---
## TL;DR

- **Bản chất**: Gộp bước **Kiểm tra điều kiện (Check)** và bước **Ghi dữ liệu (Write)** thành **một thao tác nguyên tử duy nhất (Single Indivisible Operation)** tại tầng Storage Engine của Database.
- **Mục đích**: Triệt tiêu lỗi tranh chấp dữ liệu đồng thời (**Race Condition / TOCTOU**) với độ trễ cực thấp, tránh cạn kiệt Connection Pool và không gây nghẽn hàng đợi như Pessimistic Locking.
- **Điểm mấu chốt**: Không phải là "chia nhỏ dữ liệu", mà là nguyên lý "Tất cả hoặc không gì cả" (All-or-Nothing). Chỉ cập nhật nếu điều kiện logic còn đúng tại chính thời điểm ghi đĩa.

---

## 1. Bản chất của từ "Atomic" (Tính nguyên tử)

Từ **Atomic** xuất phát từ tiếng Hy Lạp _atomos_ nghĩa là **"không thể phân chia"**:

```
[ CÁCH THÔNG THƯỜNG: 2 BƯỚC RỜI RẠC ]
Bước 1: SELECT (Check: stock > 0) ──► [ KHE HỞ THỜI GIAN (TOCTOU) ] ──► Bước 2: UPDATE (Write)
                                       ▲
                         Request khác chen vào đây gây Race Condition!

[ ATOMIC CONDITIONAL UPDATE: 1 BƯỚC DUY NHẤT ]
UPDATE products SET stock = stock - 1 WHERE id = 123 AND stock > 0;
▲
Check và Write diễn ra đồng thời trong 1 chu kỳ khóa dòng cực ngắn tại Storage Engine.
```

- **Không phải:** Cập nhật từng phần nhỏ.
- **Chính là:** Thực thi trọn gói trong một bước duy nhất. Không có bất kỳ tiến trình nào có thể chen vào giữa lúc kiểm tra điều kiện và lúc thực hiện phép trừ.

---

## 2. Cơ chế vận hành thực tế

### Câu lệnh SQL chuẩn mẫu

```sql
UPDATE products
SET stock = stock - 1,
    updated_at = NOW()
WHERE id = 123
  AND stock > 0
RETURNING stock;
```

### Xử lý kết quả trả về tại tầng ứng dụng (Application Layer)

Database trả về số dòng thực sự bị thay đổi (`affected_rows` hoặc giá trị `RETURNING`):

1. **Nếu `affected_rows == 1`:** Điều kiện `stock > 0` thỏa mãn $\rightarrow$ Trừ kho thành công $\rightarrow$ Cho phép tạo đơn hàng.
2. **Nếu `affected_rows == 0`:** Tại thời điểm ghi, `stock` đã bằng `0` $\rightarrow$ Database bỏ qua và không sửa đổi gì $\rightarrow$ Ứng dụng lập tức trả về lỗi "Hết hàng" (Fail-fast) mà không tốn tài nguyên chờ đợi.

---

## 3. So sánh đối đầu: Atomic Update vs. Pessimistic Locking

| Tiêu chí                                    | Pessimistic Locking (`FOR UPDATE`)                                                              | Atomic Conditional Update                                                                                              |
| :------------------------------------------ | :---------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **Cơ chế**                                  | Giữ Exclusive Lock từ lúc `SELECT` đến hết `COMMIT`.                                            | Giữ Row Lock trong tích tắc thực thi câu lệnh `UPDATE`.                                                                |
| **Thời gian giữ khóa**                      | Dài (tương đương toàn bộ thời gian chạy transaction).                                           | Cực ngắn (micro-giây tại Storage Engine).                                                                              |
| **Hành vi khi có 2,000 request tranh chấp** | 1,999 request phải **xếp hàng chờ tuần tự** $\rightarrow$ Dễ cạn Connection Pool, tăng Latency. | 1 request thành công, 1,999 request **thất bại ngay lập tức (Fail-fast)** $\rightarrow$ Giải phóng connection tức thì. |
| **Trường hợp sử dụng phù hợp**              | Khi cần đọc dữ liệu lên để tính toán logic phức tạp nhiều bước trước khi ghi.                   | Khi chỉ cần kiểm tra điều kiện ngưỡng và cộng/trừ số lượng (tồn kho, số dư tài khoản, lượt like, quota).               |

---

## 4. Ví dụ triển khai với ORM (Drizzle / Node.js)

```typescript
import { eq, and, gt, sql } from "drizzle-orm";

async function decrementStock(
  productId: number,
  quantity: number,
): Promise<boolean> {
  const result = await db
    .update(products)
    .set({
      stock: sql`${products.stock} - ${quantity}`,
    })
    .where(
      and(
        eq(products.id, productId),
        sql`${products.stock} >= ${quantity}`, // Guard condition
      ),
    )
    .returning({ updatedStock: products.stock });

  // Nếu mảng trả về rỗng -> Không có dòng nào thỏa mãn -> Hết hàng
  return result.length > 0;
}
```

---

## Related Notes

- [[Postgres_Select_For_Update_Pessimistic_Locking]]
- [[Database_Indexing_Guidelines]]
- [[Outbox_Pattern]]
- [[000_Tech_MOC]]
