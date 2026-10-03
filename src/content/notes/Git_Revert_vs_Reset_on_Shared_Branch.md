---
title: "Git Revert vs Reset on Shared Branch"
description: "Phân tích rủi ro khi dùng git reset trên Shared Branch (main, develop), và nguyên lý an toàn của git revert trong môi trường cộng tác nhiều người."
date: "2026-09-22"
tags: ["type/method", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Methods/Engineering/Git_Revert_vs_Reset_on_Shared_Branch.md"
---
# Git Revert vs Reset on Shared Branch

## TL;DR

- **Bản chất**: **Shared Branch** là nhánh dùng chung mà nhiều developer cùng clone/pull về máy (`main`, `develop`, `release`).
- **Quy tắc an toàn**: Trên Shared Branch đã `git push`, **BẮT BUỘC dùng `git revert`** (tiến về phía trước), **CẤM dùng `git reset`** (lùi lại và viết lại lịch sử).
- **Điểm mấu chốt**: `git reset` xóa bỏ commit khỏi lịch sử nhánh, ép buộc phải dùng `push --force` $\rightarrow$ làm hỏng lịch sử của toàn bộ thành viên khác. Ngược lại, `git revert` tạo ra một commit **MỚI** có nội dung đảo ngược hoàn toàn thay đổi của commit lỗi, giữ nguyên tính tuyến tính của lịch sử.

---

## Core Concept

### 1. Shared Branch là gì?

- **Shared Branch (Nhánh dùng chung)**: Là bất kỳ nhánh nào đã được `push` lên Remote Repository (GitHub, GitLab) và có **từ 2 người trở lên** đang dựa vào các commit trên nhánh đó để phát triển (ví dụ: `main`, `master`, `develop`, `staging`, hoặc nhánh `feature/team-auth` có nhiều người cùng code).
- **Private Branch (Nhánh cá nhân)**: Là nhánh chỉ một mình bạn làm việc trên máy local (hoặc nhánh feature cá nhân chưa có ai pull về).

---

### 2. Thảm họa khi dùng `git reset` trên Shared Branch

Giả sử commit `C` bị lỗi trên nhánh `main` và đã được push lên Remote:

```
[A] <── [B] <── [C (Lỗi)] <── (main trên Remote & mọi máy của đồng nghiệp)
```

Nếu bạn chạy `git reset --hard HEAD~1` và `git push --force`:

1. Remote bị ép lùi về `B` (Commit `C` biến mất trên Remote).
2. Khi đồng nghiệp chạy `git pull`, Git sẽ phát hiện lịch sử bị phân nhánh (Diverged) và tự động merge commit `C` từ máy của đồng nghiệp ngược trở lại Remote $\rightarrow$ **Lỗi cũ tự động hồi sinh**.
3. Nếu đồng nghiệp lỡ `rebase` theo, commit của họ có nguy cơ bị ghi đè hoặc tạo ra hàng loạt xung đột không thể giải quyết.

---

### 3. Cơ chế cứu nguy an toàn của `git revert`

Thay vì xóa commit `C`, `git revert <SHA-of-C>` tạo ra một **Commit MỚI `C'`**:

```
[A] <── [B] <── [C (Lỗi)] <── [C' (Đảo ngược C)] <── (main: Tiến về phía trước)
```

- Nội dung của `C'`: Bỏ đi toàn bộ code mà `C` đã thêm vào, và thêm lại toàn bộ code mà `C` đã xóa.
- **Tính tương thích**: Lịch sử commit luôn **đi thẳng về phía trước (Append-only)**.
- Khi đồng nghiệp `git pull`, máy của họ chỉ cần tải thêm commit `C'` một cách bình thường, không có xung đột, không cần force push.

---

## Practical Implementation

### 1. Revert một commit đơn lẻ đã push

```bash
# Đảo ngược commit gần nhất
git revert HEAD

# Đảo ngược một commit cụ thể trong quá khứ
git revert a1b2c3d
```

### 2. Revert một Merge Commit (Cần chỉ định cờ `-m`)

Khi revert một merge commit (có 2 parent), bạn phải báo cho Git biết muốn giữ lại nhánh nào làm nhánh chính (Parent 1 thường là nhánh đích như `main`):

```bash
# Giữ lại parent 1 (main), đảo ngược nhánh feature vừa merge nhầm
git revert -m 1 <merge-commit-sha>
```

---

## Related Notes

- [[Git_Four_Zones_and_Reset_Lifecycle]]: Chi tiết hoạt động của 3 cờ `reset` (`--soft`, `--mixed`, `--hard`).
- [[Git_DAG_and_Object_Storage_Model]]: Bản chất Append-only của đồ thị DAG trong Git.
- [[000_Methods_MOC]]: Danh mục các quy trình và phương pháp kỹ thuật.
