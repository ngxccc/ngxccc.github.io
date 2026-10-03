---
title: "Git Branch Deletion and Recovery Mechanics"
description: "Cơ chế xóa an toàn (git branch -d) vs ép buộc (-D), bản chất xóa file tham chiếu trong .git/refs/heads, và quy trình 2 bước khôi phục nhánh đã xóa bằng git reflog."
date: "2026-09-22"
tags: ["type/method", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Methods/Engineering/Git_Branch_Deletion_and_Recovery_Mechanics.md"
---

# Git Branch Deletion and Recovery Mechanics

## TL;DR

- **Bản chất**: `git branch -d` **chỉ xóa file text 41 bytes** trong `.git/refs/heads/<branch>`, **không hề xóa commit hay dữ liệu**. Commit chỉ trở thành "commit mồ côi" (Dangling Commit) và vẫn tồn tại trong Object Store ít nhất 30-90 ngày trước khi `git gc` dọn dẹp.
- **Mục đích**: `git branch -d` bảo vệ an toàn bằng cách kiểm tra Merge Status trước khi xóa; `git branch -D` bỏ qua kiểm tra an toàn.
- **Điểm mấu chốt**: Khôi phục branch đã xóa chỉ mất 2 bước: Lấy lại Commit SHA cuối cùng qua `git reflog`, sau đó tái tạo lại con trỏ branch bằng `git branch <tên-nhánh> <commit-sha>`.

---

## Core Concept

### 1. Phân biệt `git branch -d` vs `git branch -D`

1. **`git branch -d <name>` (Safe Delete / `--delete`)**:
   - Git kiểm tra xem commit đỉnh của branch đã được merge vào `HEAD` (nhánh hiện tại) hoặc `upstream` chưa.
   - Nếu **chưa merge**: Git chặn lại và báo lỗi: `error: The branch '<name>' is not fully merged`.
2. **`git branch -D <name>` (Force Delete / `-d -f`)**:
   - Bỏ qua kiểm tra merge status, xóa ngay lập tức file ref `.git/refs/heads/<name>`.

---

### 2. Bản chất bên dưới: Dữ liệu có mất không?

- Khi tạo branch: Git tạo file `.git/refs/heads/feature` chứa mã SHA.
- Khi xóa branch (`git branch -d` hoặc `-D`): Git **chỉ xóa file ref đó**.
- Toàn bộ commit DAG, blob code, tree object trong `.git/objects/` **vẫn nguyên vẹn 100%**.

---

### 3. Quy trình 2 bước khôi phục nhánh đã xóa

```
[git reflog] ──> Tìm SHA commit đỉnh cũ ──> [git branch <name> <SHA>] ──> Đã khôi phục
```

#### Bước 1: Tra cứu SHA của commit đỉnh cũ trong `reflog`

```bash
git reflog
# Tìm dòng ghi lại thao tác cuối cùng trên branch đã xóa:
# e4d8c1b HEAD@{2}: commit: feat: finish checkout logic
```

#### Bước 2: Tạo lại con trỏ branch trỏ vào SHA đó

## Practical Implementation

```bash
git branch feature-checkout e4d8c1b
# Hoặc checkout và switch luôn:
# git checkout -b feature-checkout e4d8c1b
```

---

## Concrete Examples

### Kịch bản cứu nguy khi lỡ tay xóa nhầm branch

```bash
# 1. Lỡ tay xóa ép buộc
git branch -D feature-payment

# 2. Xem reflog để lấy lại SHA
git reflog -n 5

# 3. Khôi phục lại branch nguyên trạng
git branch feature-payment HEAD@{1}
```

---

## Related Notes

- [[Git_DAG_and_Object_Storage_Model]]: Bản chất con trỏ branch và tính bất biến của Object Store.
- [[Git_Four_Zones_and_Reset_Lifecycle]]: Vòng đời commit và cứu dữ liệu.
- [[000_Methods_MOC]]: Danh mục các phương pháp và quy trình kỹ thuật.
