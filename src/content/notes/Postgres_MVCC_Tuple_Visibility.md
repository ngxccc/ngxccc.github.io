---
title: "Postgres MVCC Tuple Visibility"
description: "Cơ chế quản lý truy cập đồng thời đa phiên bản (MVCC), vòng đời Tuple và khả năng hiển thị dữ liệu (Visibility) trong PostgreSQL."
date: "2026-09-16"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Tech/API_and_Data_Design/Postgres_MVCC_Tuple_Visibility.md"
---
# Postgres MVCC Tuple Visibility

## TL;DR

- **Bản chất**: PostgreSQL thực thi quy tắc "Không sửa đè" (Out-of-place Update). Mọi thao tác `UPDATE` và `DELETE` không chỉnh sửa trực tiếp dữ liệu tại chỗ, mà ghi thêm Tuple phiên bản mới và đánh dấu trạng thái hết hạn trên Tuple cũ thông qua Transaction ID.
- **Mục đích**: Hiện thực hóa triết lý "Người đọc không chặn người ghi, người ghi không chặn người đọc" (Readers never block Writers, Writers never block Readers), cho phép hàng nghìn truy vấn đồng thời với độ trễ tối thiểu.
- **Điểm mấu chốt**: Tính hiển thị (Visibility) của một Tuple được xác định thông qua việc so sánh Transaction ID của truy vấn với hai trường ẩn `xmin` (ID tạo) và `xmax` (ID hủy/cập nhật) nằm trong Header của Tuple.

---

## 1. Cấu trúc vật lý của một Tuple Header

Mỗi hàng dữ liệu (Tuple) lưu trữ trên các trang đĩa (Heap Page 8KB) của PostgreSQL đều chứa một phần Header với các trường điều khiển trạng thái đồng thời:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              TUPLE HEADER                              │
├──────────────┬──────────────┬──────────────────┬───────────────────────┤
│    xmin      │    xmax      │  t_ctid (vị trí) │  t_infomask (flags)   │
│  (4 bytes)   │  (4 bytes)   │    (6 bytes)     │       (2 bytes)       │
├──────────────┴──────────────┴──────────────────┴───────────────────────┤
│                             USER DATA PAYLOAD                          │
│                   id = 1, name = 'Product A', price = 100              │
└────────────────────────────────────────────────────────────────────────┘
```

- **`xmin` (Creation XID)**: Transaction ID của giao dịch đã chèn (`INSERT`) hoặc sinh ra phiên bản Tuple này.
- **`xmax` (Expiry XID / Lock XID)**:
  - Nếu Tuple còn hiệu lực: $xmax = 0$.
  - Nếu Tuple đã bị xóa (`DELETE`) hoặc cập nhật (`UPDATE`): $xmax$ lưu Transaction ID của giao dịch thực hiện hành động đó.
  - Nếu hàng bị khóa (`SELECT FOR UPDATE`): $xmax$ tạm thời lưu Transaction ID của giao dịch giữ khóa.
- **`t_ctid` (Current Tuple ID)**: Con trỏ địa chỉ vật lý `(page_number, tuple_index)`. Khi một Tuple bị `UPDATE`, `t_ctid` của Tuple cũ sẽ trỏ thẳng tới vị trí của Tuple mới sinh ra.

---

## 2. Vòng đời của Tuple qua INSERT, UPDATE và DELETE

```
[ INSERT ] ──► Ghi Tuple 1: [xmin = 100, xmax = 0, ctid = (0,1)]
                  │
[ UPDATE ] ──► Không sửa đè! Thực hiện 2 hành động:
                  1. Cập nhật Tuple 1: [xmin = 100, xmax = 101, ctid = (0,2)]  (Tuple cũ hết hạn)
                  2. Chèn mới Tuple 2: [xmin = 101, xmax = 0,   ctid = (0,2)]  (Tuple mới hiệu lực)
                  │
[ DELETE ] ──► Cập nhật Tuple 2: [xmin = 101, xmax = 102, ctid = (0,2)]        (Đánh dấu đã bị xóa)
```

1. **Khi `INSERT`**:
   - Engine tạo Tuple mới với `xmin = XID_hiện_tại`, `xmax = 0`.
2. **Khi `UPDATE`**:
   - Tuple cũ được gán `xmax = XID_hiện_tại`.
   - Tuple mới được tạo ra ở trang đĩa khác với `xmin = XID_hiện_tại` và `xmax = 0`.
   - Cả hai phiên bản cùng tồn tại trên đĩa cho đến khi được thu hồi.
3. **Khi `DELETE`**:
   - Engine không giải phóng bộ nhớ ngay lập tức mà chỉ cập nhật `xmax = XID_hiện_tại` trên Tuple mục tiêu.

---

## 3. Quy tắc kiểm tra tính hiển thị (Visibility Rules)

Khi một câu lệnh `SELECT` thực thi, nó chụp một **Snapshot** của cơ sở dữ liệu tại thời điểm đó. Snapshot chứa:

- `xmin`: Transaction ID nhỏ nhất vẫn đang hoạt động (Active).
- `xmax`: Transaction ID đầu tiên chưa được cấp phát.
- `xip_list`: Danh sách các Transaction ID đang chạy đồng thời tại thời điểm chụp snapshot.

```
                    ĐIỀU KIỆN TUPLE HIỂN THỊ TRONG SNAPSHOT
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
       1. ĐÃ ĐƯỢC TẠO CHƯA?                          2. ĐÃ BỊ HỦY CHƯA?
  • Tuple xmin đã COMMIT?                       • Tuple xmax = 0? (Chưa ai hủy)
  • xmin < Snapshot.xmin?                                     HOẶC
  • xmin KHÔNG nằm trong Snapshot.xip_list?     • xmax chưa COMMIT hoặc bị ROLLBACK?
                                                              HOẶC
                                                • xmax > Snapshot.xmax?
```

Một Tuple hiển thị với câu lệnh `SELECT` khi và chỉ khi:

1. Giao dịch tạo ra nó (`xmin`) đã hoàn tất `COMMIT` trước khi Snapshot được tạo.
2. Giao dịch xóa/sửa nó (`xmax`) chưa xảy ra, đã bị `ROLLBACK`, hoặc được thực thi bởi một giao dịch chưa `COMMIT` tại thời điểm chụp Snapshot.

Nhờ cơ chế này, câu lệnh `SELECT` đọc trực tiếp phiên bản hợp lệ của Tuple mà không cần đợi các câu lệnh `UPDATE` hay `DELETE` khác nhả khóa.

---

## 4. Hệ quả vật lý: Dead Tuples và vai trò của VACUUM

Cơ chế "Không sửa đè" mang lại khả năng xử lý song song cực cao, nhưng đánh đổi bằng việc tích lũy các bản ghi rác trên đĩa:

- **Dead Tuples (Hàng chết)**: Các Tuple có `xmax` thuộc về các giao dịch đã `COMMIT` trong quá khứ và không còn bất kỳ Snapshot nào đang chạy có thể nhìn thấy.
- **Table Bloat (Phình bảng)**: Không gian đĩa chứa Dead Tuples không tự động co lại sau khi hoàn tất giao dịch. Nếu bảng nhận lượng `UPDATE/DELETE` lớn liên tục, kích thước tệp vật lý sẽ tăng mất kiểm soát.
- **Cơ chế VACUUM / AutoVacuum**:
  1. Quét qua các Heap Page để xác định Dead Tuples.
  2. Xóa các mục trỏ đến Dead Tuples trong B+ Tree Index.
  3. Đánh dấu không gian của Dead Tuples là "vùng trống khả dụng" (Free Space Map) để các câu lệnh `INSERT`/`UPDATE` tiếp theo tái sử dụng mà không cần cấp phát thêm đĩa.

---

## 5. Truy vấn quan sát thực tế trong PostgreSQL

Ta có thể quan sát trực tiếp các trường ẩn `xmin`, `xmax`, và `ctid` bằng SQL:

```sql
-- Tạo bảng thử nghiệm
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    name TEXT
);

-- 1. Thao tác INSERT
INSERT INTO items (name) VALUES ('Laptop');
SELECT ctid, xmin, xmax, id, name FROM items;
-- Kết quả: ctid = (0,1), xmin = 501, xmax = 0

-- 2. Thao tác UPDATE
UPDATE items SET name = 'Laptop Pro' WHERE id = 1;
SELECT ctid, xmin, xmax, id, name FROM items;
-- Kết quả: ctid = (0,2), xmin = 502, xmax = 0
-- (Tuple cũ ở ctid (0,1) đã trở thành Dead Tuple với xmax = 502)
```

---

## Related Notes

- [[Postgres_Select_For_Update_Pessimistic_Locking]]
- [[Atomic_Conditional_Update]]
- [[Index_BPlusTree]]
- [[Database_Indexing_Guidelines]]
- [[000_Tech_MOC]]
