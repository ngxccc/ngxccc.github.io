---
title: "Git Merge Base Algorithm"
description: "Cơ chế tìm điểm phân nhánh (Merge Base) trong đồ thị DAG của Git, giải thuật Lowest Common Ancestor (LCA) với sơn cờ Bitwise và đồ thị cam kết commit-graph."
date: "2026-09-22"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/Git_Merge_Base_Algorithm.md"
---

# Git Merge Base Algorithm

## TL;DR

- **Bản chất**: Git **không** liên tục so sánh commit cha từng cặp một cách tuyến tính thô sơ, mà thực hiện phép duyệt đồ thị **Lowest Common Ancestor (LCA)** bằng thuật toán duyệt theo chiều rộng (BFS / Priority Queue theo commit timestamp) kết hợp kỹ thuật **sơn cờ bitwise (Commit Flags)** trên đồ thị DAG.
- **Mục đích**: Xác định chính xác commit tổ tiên chung gần nhất (`BASE`) giữa hai hoặc nhiều nhánh để làm hệ quy chiếu cho thuật toán Three-Way Merge và tính toán Git Diff / Rebase.
- **Điểm mấu chốt**: Mỗi commit được gán các bit cờ (`PARENT1`, `PARENT2`, `COMMON`). Khi duyệt ngược từ 2 đỉnh nhánh, commit nào tích lũy đủ cờ từ cả hai nhánh sẽ trở thành tổ tiên chung. Git lọc tiếp để loại bỏ các tổ tiên bị che khuất (stale common ancestors) để tìm ra điểm hội tụ tối ưu gần nhất. Với file `commit-graph` (Generation Numbers / Topological Levels), Git có thể cắt tỉa (pruning) việc duyệt để tìm kết quả gần như tức thì ($O(V+E)$).

---

## Core Concept

### 1. Bản chất vấn đề: Điểm phân nhánh là gì?

Trên đồ thị DAG (Directed Acyclic Graph) của Git:

- Các commit luôn có con trỏ **ngược** về commit cha (`parent`).
- Hai nhánh rẽ đôi từ một thời điểm trong quá khứ thực chất là hai đường đi xuất phát từ cùng một commit gốc `A`:

```
          ┌──> [B] ──> [C] ──> [D] (feature: commit tip 1)
          │
[Commit A: BASE]
          │
          └──> [E] ──> [F] (main: commit tip 2)
```

Để thực hiện phép gộp nhánh (`git merge`) hoặc tính `git diff feature...main`, Git bắt buộc phải tìm ra commit `A`. Lệnh đại diện cho cơ chế này trong Git là:

```bash
git merge-base feature main
# Trả về: SHA của Commit A
```

---

### 2. Thuật toán Bitwise Reachability Flags (Cơ chế bên trong Git)

Git không duyệt danh sách chuỗi commit thô. Trong mã nguồn C của Git (`commit-reach.c`), Git sử dụng một hàng đợi ưu tiên (Priority Queue sắp xếp theo `commit->date`) cùng các bit cờ nội bộ (bitflags):

- **Bit 1 (`FLAG_1`)**: Đánh dấu commit có thể tiếp cận được (reachable) từ Đỉnh 1 (`feature`).
- **Bit 2 (`FLAG_2`)**: Đánh dấu commit có thể tiếp cận được từ Đỉnh 2 (`main`).
- **Bit `COMMON`**: Khi một commit nhận được cả `FLAG_1` và `FLAG_2` (`flags & (FLAG_1 | FLAG_2) == BOTH`), nó chính thức được đánh dấu là một **Tổ tiên chung (Common Ancestor)**.

#### Quy trình từng bước:

1. **Khởi tạo**:
   - Commit đỉnh của Branch 1 được sơn cờ `FLAG_1` và đẩy vào Priority Queue.
   - Commit đỉnh của Branch 2 được sơn cờ `FLAG_2` và đẩy vào Priority Queue.
2. **Duyệt lan truyền (BFS / Priority Queue)**:
   - Lấy commit có thời gian mới nhất ra khỏi Queue.
   - Truyền toàn bộ cờ của commit hiện tại xuống tất cả các commit cha (`parent`).
   - Nếu commit cha kế thừa cờ mới, đẩy commit cha vào Queue.
3. **Phát hiện Common Ancestor**:
   - Ngay khi một commit có đủ cả hai cờ `FLAG_1` và `FLAG_2`, nó được đánh dấu là `COMMON`.
   - Một khi một nút đã là `COMMON`, toàn bộ tổ tiên phía sau của nó cũng sẽ được sơn cờ `COMMON`.
4. **Cắt tỉa & Kết luận (Pruning)**:
   - Git tiếp tục duyệt cho đến khi tất cả các phần tử còn lại trong Queue đều đã là `COMMON` (hoặc Queue rỗng).
   - Nút `COMMON` nằm ở vị trí cao nhất (gần hai đỉnh nhánh nhất về mặt đồ thị) chính là **Merge Base**.

---

### 3. Trường hợp phức tạp: Criss-Cross Merge (Nhiều Merge Base)

Trong các dự án lớn khi các nhánh thường xuyên merge chéo qua lại (Criss-Cross Merge), có thể tồn tại **nhiều hơn một Lowest Common Ancestor**:

```
      ┌──> [B] ────────┬──> [D] (branch 1)
      │      \        /
[A] ──┤       X──────X
      │      /        \
      └──> [C] ────────┴──> [E] (branch 2)
```

Ở đồ thị trên: Cả `B` và `C` đều là tổ tiên chung độc lập của `D` và `E`, và không có cái nào là con của cái nào.

- Trong trường hợp này, `git merge-base -a branch1 branch2` sẽ trả về cả 2 commit SHA (`B` và `C`).
- Khi thực thi `git merge` (chiến lược `ort` hoặc `recursive`), Git giải quyết bằng cách **tự động tạo một commit ảo (Virtual Merge Base)** là kết quả merge giữa `B` và `C`, rồi lấy commit ảo đó làm `BASE` để thực hiện 3-Way Merge cho `D` và `E`.

---

### 4. Tối ưu hóa hiệu năng: `commit-graph` và Generation Numbers

Trong repository có hàng trăm nghìn commit (như Linux Kernel), việc lần theo parent ngược về có thể tốn thời gian. Git hiện đại sử dụng:

1. **`commit-graph` (`.git/objects/info/commit-graph`)**: Một file nhị phân lưu sẵn bảng chỉ mục commit, danh sách parent và **Generation Numbers (Topological Levels)**.
2. **Generation Number**: Mỗi commit có một độ sâu topo $G(C) = \max(G(parent)) + 1$.
   - Nếu $G(Commit_X) < G(Common\_Ancestor)$, Git lập tức **bỏ qua (prune)** toàn bộ nhánh của $Commit_X$ mà không cần đọc dữ liệu đối tượng từ đĩa.

---

## Concrete Examples

### Truy vấn Merge Base trong thực tế

```bash
# Tìm commit phân nhánh giữa branch tính năng và main
git merge-base feature/checkout main
# Output: e4d8c1b98a723...

# Kiểm tra xem commit A có phải là tổ tiên của commit B không (exit code 0 nếu đúng)
git merge-base --is-ancestor e4d8c1b main

# Liệt kê tất cả các merge base nếu có xung đột criss-cross
git merge-base -a feature/auth feature/payment
```

---

## Related Notes

- [[Git_DAG_and_Object_Storage_Model]]: Nền tảng cấu trúc dữ liệu đồ thị DAG và con trỏ Parent.
- [[Git_Conflict_and_Three_Way_Merge_Mechanics]]: Cách thuật toán Three-Way Merge sử dụng Merge Base để phát hiện xung đột.
- [[000_Concepts_MOC]]: Danh mục lý thuyết và nguyên lý cốt lõi.
