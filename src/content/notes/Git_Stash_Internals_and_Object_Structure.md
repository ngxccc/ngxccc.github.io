---
title: "Git Stash Internals and Object Structure"
description: "Cơ chế lưu trữ bên trong của Git Stash: tạo 2 (hoặc 3) commit đặc biệt liên kết với refs/stash thay vì lưu bộ nhớ tạm độc lập."
date: "2026-09-22"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/Git_Stash_Internals_and_Object_Structure.md"
---
## TL;DR

- **Bản chất**: `git stash` không hề có vùng nhớ tạm "ma thuật" nào riêng biệt. Nó thực chất là **tạo 2 (hoặc 3) commit tạm thời bình thường** trên đồ thị DAG và gắn vào con trỏ tham chiếu `.git/refs/stash`.
- **Mục đích**: Lưu lại trạng thái chưa hoàn thiện của cả Working Directory và Index (Staging Area) để đưa thư mục làm việc về trạng thái sạch sẽ (`HEAD`) mà không làm ô nhiễm nhánh làm việc.
- **Điểm mấu chốt**: Mỗi lần stash, Git tạo ra: Commit 1 (lưu Staging Area), Commit 2 (lưu Working Directory, có 2 commit cha: `HEAD` và Commit 1). Nếu dùng `git stash -u` (include untracked), Git tạo thêm Commit 3 lưu riêng các file Untracked. Danh sách `stash@{0}`, `stash@{1}` được quản lý bởi `logs/refs/stash`.

---

## Core Concept

### 1. Cấu trúc 2 Commit mặc định của `git stash`

Khi bạn chạy `git stash push` (hoặc `git stash`):

```
       [Index / Staged Changes] (Commit W1)
             ^
             │ (Parent 2)
[HEAD] <─── [Working Dir Changes] (Commit W: refs/stash)
  ^
  │ (Parent 1)
```

1. **Commit `W1` (Staged Commit)**:
   - Đại diện cho các file bạn đã `git add` vào Staging Area.
   - Commit cha của `W1` là `HEAD`.
2. **Commit `W` (WIP Commit - Đỉnh Stash)**:
   - Đại diện cho các file đã sửa đổi trong Working Directory.
   - **Có 2 commit cha (Merge Commit ảo)**: Parent 1 là `HEAD`, Parent 2 là Commit `W1`.
   - Con trỏ `.git/refs/stash` được cập nhật trỏ thẳng vào commit `W` này.

---

### 2. Cấu trúc 3 Commit khi stash kèm Untracked Files (`git stash -u`)

Khi thêm cờ `-u` (`--include-untracked`):

```
       [Untracked Files] (Commit W2) ───┐ (Parent 3)
                                        │
       [Staged Changes]  (Commit W1) ───┼──> [Commit W (refs/stash)]
                                        │       │
[HEAD] <────────────────────────────────┘       └──> (Parent 1)
```

- Git tạo thêm Commit `W2` để lưu ảnh chụp các file chưa được track.
- Commit `W` lúc này trở thành commit có tới **3 Parent**.

---

### 3. Ngăn xếp Stash Stack (`stash@{0}`, `stash@{1}`) hoạt động như thế nào?

- Git không lưu một danh sách mảng (Array).
- Git ghi nhận lịch sử thay đổi của ref `refs/stash` vào file nhật ký **`logs/refs/stash`**.
- Mỗi lần bạn `git stash pop`, Git giải nén các tree object của commit stash áp ngược lại vào thư mục làm việc và cập nhật `refs/stash` lùi lại 1 bước trong `reflog`.

---

## Practical Implementation

### So sánh các lệnh Stash phổ biến

```bash
# 1. Stash toàn bộ thay đổi (bao gồm cả untracked files)
git stash -u -m "wip: shopping cart checkout"

# 2. Xem các commit thực sự được tạo bởi stash
git log --graph --oneline refs/stash -n 3

# 3. Áp dụng lại stash mà vẫn giữ nguyên trạng thái Staging ban đầu
git stash apply --index

# 4. Xóa stash đỉnh sau khi apply thành công
git stash drop stash@{0}
```

---

## Related Notes

- [[Git_DAG_and_Object_Storage_Model]]: Nền tảng cấu trúc Commit, Tree, Blob trong Git.
- [[Git_Four_Zones_and_Reset_Lifecycle]]: 4 vùng làm việc trong Git.
- [[000_Concepts_MOC]]: Danh mục các khái niệm khoa học máy tính.
