---
title: "Git Conflict and Three-Way Merge Mechanics"
description: "Nguyên lý thuật toán Three-Way Merge, phân tích mâu thuẫn giữa BASE, OURS, THEIRS, và quy trình giải quyết xung đột trong Git Merge vs Rebase."
date: "2026-09-20"
tags: ["type/method", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Methods/Engineering/Git_Conflict_and_Three_Way_Merge_Mechanics.md"
---
# Git Conflict and Three-Way Merge Mechanics

## TL;DR

- **Bản chất**: Git không so sánh trực tiếp 2 file với nhau (2-Way Diff), mà vận hành dựa trên **Thuật toán Gộp 3 Chiều (Three-Way Merge)** giữa điểm tổ tiên chung gần nhất (`BASE`), nhánh hiện tại (`OURS`/`HEAD`), và nhánh gộp (`THEIRS`).
- **Mục đích**: Tự động tích hợp các thay đổi không chồng lấn và phát hiện chính xác các xung đột logic khi hai nhánh cùng biến đổi một đoạn mã so với điểm gốc.
- **Điểm mấu chốt**: Conflict chỉ xuất hiện khi cả hai nhánh cùng sửa đổi cùng một dòng/vùng mã nhưng cho ra kết quả khác nhau so với `BASE`. Giải quyết conflict trong `git merge` diễn ra một lần tại Merge Commit; trong khi `git rebase` diễn ra tuần tự từng commit một với nhãn `OURS`/`THEIRS` bị đảo ngược.

---

## Core Concept

### 1. Thuật toán Three-Way Merge: BASE, OURS và THEIRS

Khi thực thi thao tác gộp nhánh, Git tìm kiếm commit tổ tiên chung gần nhất (`BASE` / Common Ancestor) thông qua giải thuật tìm kiếm Lowest Common Ancestor (xem chi tiết cơ chế hoạt động tại [[Git_Merge_Base_Algorithm]]):

```
          ┌──> [Commit B] ──> [Commit C (THEIRS: feature)]
          │
[BASE: Commit A]
          │
          └──> [Commit D ──> Commit E (OURS: main)]
```

- **`BASE` (Common Ancestor)**: Trạng thái mã nguồn tại commit `A` trước khi hai nhánh rẽ đôi.
- **`OURS` (`HEAD`)**: Trạng thái mã nguồn trên nhánh hiện tại bạn đang đứng (`main`).
- **`THEIRS` (Incoming Branch)**: Trạng thái mã nguồn trên nhánh đang được tích hợp vào (`feature`).

#### Ma trận Ra quyết định của Git Engine

| Dòng tại BASE | Dòng tại OURS       | Dòng tại THEIRS     | Quyết định của Git                  | Trạng thái     |
| :------------ | :------------------ | :------------------ | :---------------------------------- | :------------- |
| `x = 1`       | `x = 1` (Không đổi) | `x = 2` (Đã sửa)    | Tự động lấy `x = 2`                 | **Auto-merge** |
| `x = 1`       | `x = 2` (Đã sửa)    | `x = 1` (Không đổi) | Tự động giữ `x = 2`                 | **Auto-merge** |
| `x = 1`       | `x = 2` (Đã sửa)    | `x = 2` (Đã sửa)    | Giữ `x = 2` (Cùng sửa giống nhau)   | **Auto-merge** |
| `x = 1`       | `x = 99` (Đã sửa)   | `x = 100` (Đã sửa)  | **Bế tắc: Cả 2 cùng sửa khác nhau** | **CONFLICT**   |

---

### 2. Cấu trúc Đánh dấu Xung đột (Conflict Markers)

Khi phát hiện xung đột, Git tạm dừng và ghi trực tiếp các ranh giới xung đột vào tập tin:

```
<<<<<<< HEAD (hoặc OURS)
const balance = 99;   // Mã nguồn trên nhánh bạn đang đứng
=======
const balance = 100;  // Mã nguồn trên nhánh đang gộp vào
>>>>>>> feature (hoặc THEIRS)
```

#### Thiết lập Hiển thị Nâng cao: `diff3` Style

Mặc định Git ẩn đi trạng thái `BASE`. Bật chế độ `diff3` giúp quan sát trực tiếp dòng mã gốc:

```bash
git config --global merge.conflictstyle diff3
```

Định dạng hiển thị sau khi bật `diff3`:

```
<<<<<<< HEAD
const balance = 99;
||||||| base
const balance = 1;    // Điểm neo gốc: Giúp hiểu lý do cả 2 bên sửa đổi
=======
const balance = 100;
>>>>>>> feature
```

---

## Practical Implementation

### 1. Quy trình Xử lý Xung đột: Merge vs Rebase

| Tiêu chí                       | Giải quyết Conflict khi `git merge`                                | Giải quyết Conflict khi `git rebase`                                                              |
| :----------------------------- | :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| **Tần suất xử lý**             | Xảy ra **1 lần duy nhất** trên toàn bộ tập tin xung đột.           | Xảy ra **từng commit một** (Replay commit-by-commit).                                             |
| **Ý nghĩa OURS / THEIRS**      | `OURS` = Nhánh hiện tại (`HEAD`).<br>`THEIRS` = Nhánh sắp gộp vào. | **Bị đảo ngược**: `OURS` là nhánh upstream làm nền; `THEIRS` là commit của bạn đang được đắp lên. |
| **Lệnh tiếp tục sau khi sửa**  | `git add <file>` $\rightarrow$ `git commit` (Tạo Merge Commit).    | `git add <file>` $\rightarrow$ `git rebase --continue`.                                           |
| **Hủy bỏ thao tác (Rollback)** | `git merge --abort` (Quay về HEAD ban đầu).                        | `git rebase --abort` (Khôi phục nhánh về vị trí an toàn).                                         |

### 2. Thao tác Thực hành Khắc phục Xung đột Chuẩn mực

```bash
# 1. Kiểm tra tập tin đang bị xung đột (Unmerged paths)
git status

# 2. Mở file, xóa triệt để các marker (<<<<<<<, =======, >>>>>>>), giữ lại logic đúng

# 3. Đánh dấu đã giải quyết xong xung đột
git add <path/to/file>

# 4a. Nếu đang thực hiện Merge:
git commit -m "merge: resolve payment conflict between main and feature"

# 4b. Nếu đang thực hiện Rebase:
git rebase --continue

# 5. Nếu gặp bế tắc và muốn hủy bỏ an toàn:
git merge --abort    # hoặc: git rebase --abort
```

---

## Related Notes

- [[Git_DAG_and_Object_Storage_Model]]
- [[Git_Four_Zones_and_Reset_Lifecycle]]
- [[Stack_vs_Heap_Memory_Fundamentals]]
- [[Master_Backend_Engineering_SSOT]]
- [[000_Methods_MOC]]
