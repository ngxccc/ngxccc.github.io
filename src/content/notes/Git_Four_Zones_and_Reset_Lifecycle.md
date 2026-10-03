---
title: "Git Four Zones and Reset Lifecycle"
description: "Phân tích 4 vùng lưu trữ trong Git, cơ chế di chuyển con trỏ của git reset (soft, mixed, hard), và kỹ thuật cứu hộ dữ liệu bằng git reflog."
date: "2026-09-20"
tags: ["type/method", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Methods/Engineering/Git_Four_Zones_and_Reset_Lifecycle.md"
---
# Git Four Zones and Reset Lifecycle

## TL;DR

- **Bản chất**: Dữ liệu trong Git di chuyển qua **4 vùng lưu trữ**: Working Directory (Đĩa cứng), Staging Area / Index (Vùng đệm), Local Repository (Lịch sử commit / HEAD), và Remote Repository.
- **Mục đích**: Tách biệt giữa trạng thái soạn thảo nháp, chuẩn bị gói commit, và lưu trữ snapshot vĩnh viễn.
- **Điểm mấu chốt**: `git reset` bản chất chỉ là lệnh **di chuyển con trỏ HEAD lùi lại** trên đồ thị commit; các cờ `--soft`, `--mixed`, `--hard` chỉ quyết định việc có kéo Staging Area và Working Directory lùi theo hay không. Mọi bước nhảy con trỏ đều được ghi lại trong `git reflog`, tạo thành mạng lưới cứu hộ tuyệt đối.

---

## Core Concept

### 1. Mô hình 4 Vùng Trạng thái (The 4 Zones)

```
[ Working Directory ] ──(git add)──> [ Staging Area (Index) ] ──(git commit)──> [ Local Repo (HEAD) ] ──(git push)──> [ Remote Repo ]
      ^                                      │                                         │
      └───────── (git checkout/restore) ─────┴──────────── (git reset) ────────────────┘
```

1. **Working Directory (Thư mục làm việc)**: Các tập tin vật lý thực tế trên ổ cứng của bạn.
2. **Staging Area / Index (Vùng đệm)**: Ảnh chụp nháp nhị phân (`.git/index`) chuẩn bị cho lần commit kế tiếp.
3. **Local Repository (Kho lưu trữ cục bộ)**: Cơ sở dữ liệu đồ thị DAG chứa toàn bộ các commit snapshot đã xác nhận, quản lý bởi con trỏ `HEAD`.
4. **Remote Repository (Kho lưu trữ từ xa)**: Máy chủ GitHub/GitLab đồng bộ các tham chiếu qua mạng.

---

## Practical Implementation

### 1. Phân biệt Bản chất: `git reset --soft` vs `--mixed` vs `--hard`

Bản chất của `git reset HEAD~1` là: **Di chuyển con trỏ HEAD lùi về commit trước đó 1 bước**. Sự khác biệt nằm ở cách xử lý 2 vùng còn lại:

| Cờ lệnh Reset              | Con trỏ HEAD      | Staging Area (Index)               | Working Directory (File đĩa)            | Mục đích sử dụng điển hình                                             |
| :------------------------- | :---------------- | :--------------------------------- | :-------------------------------------- | :--------------------------------------------------------------------- |
| **`--soft`**               | **Di chuyển lùi** | **GIỮ NGUYÊN** (Code vẫn ở Staged) | **GIỮ NGUYÊN**                          | Gộp nhiều commit nhỏ lại thành 1 (Squash) trước khi commit lại.        |
| **`--mixed`** _(Mặc định)_ | **Di chuyển lùi** | **BỊ RESET** (Unstaged)            | **GIỮ NGUYÊN**                          | Huỷ commit cũ, đưa toàn bộ thay đổi về dạng Unstaged để phân loại lại. |
| **`--hard`**               | **Di chuyển lùi** | **BỊ RESET**                       | **BỊ XÓA SỔ** (Ghi đè bằng commit đích) | **HỦY DIỆT**: Xóa bỏ toàn bộ thay đổi rác không muốn giữ lại.          |

> **Cơ chế An toàn & Ranh giới Hủy diệt của `git reset --hard`:**
>
> 1. **Đối với Untracked Files (File mới chưa từng `git add`):** `git reset --hard` **KHÔNG chạm vào và KHÔNG xóa** các file này. Chúng vẫn nằm nguyên trên ổ cứng (chỉ lệnh `git clean -f` mới xóa).
> 2. **Đối với Tracked Files (File đã được Git theo dõi từ trước):** Mọi sửa đổi chưa commit trên các file này sẽ bị **ghi đè và xóa sổ vĩnh viễn**, không thể cứu lại bằng `git reflog`.
> 3. **Đối với Commits đã tạo:** Dù bị `--hard` lùi lại bao nhiêu bước, commit cũ vẫn nằm trong Object Store và **được cứu lại 100% qua `git reflog`**.

---

### 2. Cứu hộ Dữ liệu Thảm họa bằng `git reflog`

- **Bản chất `git reflog`**: Là nhật ký cục bộ ghi lại **mọi thao tác thay đổi vị trí của con trỏ HEAD** (commit, checkout, rebase, reset).
- **Nguyên lý bất biến**: Khi bạn `git reset --hard` làm mất commit, nút commit cũ **không bị xóa khỏi ổ cứng ngay lập tức**, mà chỉ bị biến thành commit mồ côi (Unreachable commit) và được giữ lại ít nhất 30 ngày trước khi `git gc` dọn dẹp.

#### Quy trình Phục hồi Commit Bị Xóa Nhầm

```bash
# 1. Xem lại nhật ký di chuyển của con trỏ HEAD
git reflog

# Output mẫu:
# 1a2b3c4 HEAD@{0}: reset: moving to HEAD~1  <-- Vừa lỡ tay reset nhầm
# 5d6e7f8 HEAD@{1}: commit: Important Feature Logic <-- Commit bị mất cần lấy lại

# 2. Tạo một nhánh mới khôi phục ngay tại vị trí commit bị mất
git checkout -b rescue-branch 5d6e7f8

# Kết quả: Toàn bộ code quan trọng được khôi phục 100%!
```

---

## Related Notes

- [[Git_DAG_and_Object_Storage_Model]]
- [[Git_Conflict_and_Three_Way_Merge_Mechanics]]
- [[Master_Backend_Engineering_SSOT]]
- [[000_Methods_MOC]]
