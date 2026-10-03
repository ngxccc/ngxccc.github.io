---
title: "Finite State Machine and Concurrency Guard"
description: "Nguyên lý thiết kế Máy trạng thái hữu hạn (FSM) trong luồng nghiệp vụ B2B/E-commerce, ma trận chuyển trạng thái hợp lệ, và cơ chế bảo vệ chống Double-Approval Race Condition bằng Pessimistic Lock và Database Constraint."
date: "2026-09-22"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/Finite_State_Machine_and_Concurrency_Guard.md"
---

# Finite State Machine and Concurrency Guard

## TL;DR

- **Bản chất**: **Finite State Machine (FSM - Máy trạng thái hữu hạn)** là mô hình toán học định nghĩa một tập hữu hạn các trạng thái (`States`) và các quy tắc chuyển đổi hợp lệ (`Transitions`) giữa chúng.
- **Mục đích**: Triệt tiêu hoàn toàn trạng thái phi lý của hệ thống (ví dụ: đơn hàng đã `REJECTED` lại bị sửa thành `APPROVED`, hoặc báo giá được duyệt 2 lần sinh ra 2 đơn hàng trùng lặp).
- **Điểm mấu chốt**: Trong môi trường phân tán hoặc đồng thời cao, FSM thuần túy ở tầng mã nguồn (Application Code) **bắt buộc phải kết hợp với cơ chế Khóa bi quan (`SELECT ... FOR UPDATE`) hoặc Atomic Conditional Update (`UPDATE ... WHERE status = 'NEGOTIATING'`)** để ngăn chặn lỗ hổng **Double-Approval Race Condition (TOCTOU)**.

---

## Core Concept

### 1. Kiến trúc 6-Stage State Machine trong B2B Quotation

Trong nghiệp vụ đàm phán giá thiết bị công nghiệp (B2B Machinery), vòng đời báo giá được chuẩn hóa qua 6 trạng thái:

```
[DRAFT] ──> [SUBMITTED] ──> [NEGOTIATING] ──┬──> [APPROVED] (Sinh Order)
   │             │                │          ├──> [REJECTED] (Hủy bỏ)
   └───(Hủy)─────┴──(Hết hạn)─────┴──────────┴──> [EXPIRED]  (Quá hạn)
```

#### Ma trận Chuyển đổi Trạng thái (Transition Rules):

```typescript
const VALID_QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  DRAFT: ["SUBMITTED", "NEGOTIATING", "REJECTED"],
  SUBMITTED: ["NEGOTIATING", "APPROVED", "REJECTED", "EXPIRED"],
  NEGOTIATING: ["APPROVED", "REJECTED", "EXPIRED"],
  APPROVED: [], // Terminal State: Bất biến, không thể sửa đổi
  REJECTED: [], // Terminal State
  EXPIRED: [], // Terminal State
};
```

---

### 2. Nguy cơ Double-Approval Race Condition (Lỗi TOCTOU)

Giả sử 2 Sales Manager cùng bấm nút **"Approve & Convert to Order"** cho cùng 1 Báo giá `Q-1001` tại cùng một mili-giây:

```
Thời gian      Transaction 1 (Manager A)                 Transaction 2 (Manager B)
──────────────────────────────────────────────────────────────────────────────────────────
t1             SELECT status (thấy 'NEGOTIATING')         .
t2             .                                          SELECT status (thấy 'NEGOTIATING'!)
t3             Validate status == 'NEGOTIATING' (PASS)    Validate status == 'NEGOTIATING' (PASS)
t4             Tạo Order 1 (#ORD-01)                      .
t5             .                                          Tạo Order 2 (#ORD-02: BỊ TRÙNG LẶP!)
t6             UPDATE status = 'APPROVED'                 UPDATE status = 'APPROVED'
t7             COMMIT                                     COMMIT
```

👉 **Hậu quả**: Cùng 1 Báo giá nhưng sinh ra **2 Đơn hàng độc lập** trong Database $\rightarrow$ Xuất kho gấp đôi thiết bị, sai lệch kế toán và công nợ nghiêm trọng.

---

### 3. Cơ chế 2 Lớp Phòng thủ Chống Double-Approval

#### Lớp 1: Pessimistic Locking với `SELECT ... FOR UPDATE`

Mở Transaction và khóa độc quyền dòng báo giá ngay khi đọc:

```sql
BEGIN;
-- Khóa dòng Quote Q-1001, bắt Transaction 2 phải WAIT tại dòng này
SELECT * FROM quotes WHERE id = 'Q-1001' FOR UPDATE;

-- Kiểm tra FSM Invariant
IF status != 'NEGOTIATING' THEN
    ROLLBACK; -- Từ chối nếu đã bị duyệt trước đó
END IF;

-- Thực hiện tạo Order và chuyển trạng thái
INSERT INTO orders (...) VALUES (...);
UPDATE quotes SET status = 'APPROVED', order_id = 'ORD-01' WHERE id = 'Q-1001';
COMMIT;
```

#### Lớp 2: Atomic Conditional Update (Optimistic / Idempotent Guard)

Nếu không muốn giữ lock lâu, dùng câu lệnh cập nhật có điều kiện trực tiếp:

```sql
-- Chỉ cập nhật nếu trạng thái hiện tại là NEGOTIATING
UPDATE quotes
SET status = 'APPROVED', order_id = $new_order_id
WHERE id = $quote_id AND status = 'NEGOTIATING'
RETURNING id;
-- Nếu rows_affected == 0 -> Lập tức Rollback và báo lỗi "Báo giá đã được xử lý"
```

---

## Practical Implementation

### Code mẫu chuẩn mực trong NestJS / Drizzle ORM

```typescript
async approveAndConvertToOrder(quoteId: string, adminUserId: string) {
  return await this.db.transaction(async (tx) => {
    // 1. Khóa bi quan cấp dòng bằng .for('update')
    const [quote] = await tx
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .for('update');

    if (!quote) throw new NotFoundException();

    // 2. FSM Terminal State Guard
    if (quote.status === "APPROVED") {
      throw new BadRequestException("Báo giá đã được chuyển đổi đơn hàng trước đó");
    }
    if (quote.status !== "NEGOTIATING" && quote.status !== "SUBMITTED") {
      throw new BadRequestException("Trạng thái báo giá không hợp lệ để duyệt");
    }

    // 3. Tạo Order nguyên tố
    const [newOrder] = await tx.insert(orders).values({...}).returning();

    // 4. Cập nhật FSM sang APPROVED
    await tx.update(quotes).set({
      status: "APPROVED",
      orderId: newOrder.id,
    }).where(eq(quotes.id, quoteId));

    return newOrder;
  });
}
```

---

## Related Notes

- [[Postgres_Select_For_Update_Pessimistic_Locking]]: Cơ chế khóa cấp dòng trong PostgreSQL.
- [[Master_Backend_Engineering_SSOT]]: Chuẩn mực thiết kế Backend & Concurrency Control.
- [[000_Concepts_MOC]]: Danh mục lý thuyết và nguyên lý cốt lõi.
