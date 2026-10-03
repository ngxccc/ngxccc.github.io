---
title: "Git DAG and Object Storage Model"
description: "Cơ chế lưu trữ đối tượng bất biến (Blob, Tree, Commit) và cấu trúc đồ thị có hướng không chu trình (DAG) trong Git."
date: "2026-09-20"
tags: ["type/concept", "status/permanent"]
aliases: []
domain: "Engineering"
sourcePath: "30_Resources/Concepts/Computer_Science/Git_DAG_and_Object_Storage_Model.md"
---
# Git DAG and Object Storage Model

## TL;DR

- **Bản chất**: Git là một cơ sở dữ liệu địa chỉ hóa theo nội dung (Content-Addressable Storage) biểu diễn lịch sử dưới dạng **Đồ thị có hướng không chu trình (Directed Acyclic Graph - DAG)**.
- **Mục đích**: Bảo toàn tính toàn vẹn tuyệt đối của mã nguồn (Snapshot bất biến qua mã băm SHA) và hỗ trợ phân nhánh/gộp nhánh với chi phí tài nguyên gần như bằng 0.
- **Điểm mấu chốt**: Git không lưu trữ danh sách các bản vá (Diff-based), mà lưu từng ảnh chụp (Snapshot) hoàn chỉnh. Mỗi Commit trỏ ngược về Commit cha (Parent pointer). Branch và HEAD thực chất chỉ là những con trỏ tham chiếu (Refs) chứa chuỗi SHA trỏ vào một nút trên đồ thị DAG.

---

## Core Concept

### 1. Bốn Đối tượng Bất biến trong Git Object Store (`.git/objects`)

Mọi dữ liệu trong Git được nén bằng `zlib` và định danh bằng mã băm SHA (SHA-1 hoặc SHA-256):

1. **`blob` (Binary Large Object)**: Lưu trữ nội dung nhị phân của tập tin. `blob` không lưu tên file hay quyền truy cập (File permissions).
2. **`tree`**: Biểu diễn một thư mục. Chứa danh sách các con trỏ trỏ tới các `blob` (kèm tên file, mode) hoặc các `tree` con khác.
3. **`commit`**: Lưu trữ siêu dữ liệu (Metadata: tác giả, thời gian, commit message), con trỏ trỏ tới Root `tree` (ảnh chụp toàn bộ dự án tại thời điểm đó), và **danh sách các con trỏ trỏ về Commit cha (Parent Commits)**.
4. **`tag`**: Một đối tượng ghi chú trỏ cố định vào một Commit kèm thông tin ký số (GPG Signature).

---

### 2. Cấu trúc Đồ thị DAG (Directed Acyclic Graph)

- **Directed (Có hướng)**: Các commit con luôn trỏ ngược về commit cha (Parent pointer). Không có chiều ngược lại.
- **Acyclic (Không chu trình)**: Không thể tạo ra vòng lặp vô tận trong lịch sử commit.
- **Merge Commit**: Một commit có từ 2 commit cha trở lên (rẽ nhánh rồi hội tụ).
- **Initial Commit**: Commit đầu tiên không có commit cha.

```
[Commit A] <── [Commit B] <── [Commit C] (Nhánh feature)
      ^                             ^
      │                             │
      └─────── [Commit D] <── [Commit M (Merge Commit)] (Nhánh main)
```

---

### 3. Bản chất của Branch và con trỏ HEAD

- **Branch là gì?** Branch không phải là một bản sao chép thư mục và cũng không lưu danh sách commit. **Một branch thực chất chỉ là một file text 41 bytes** trong `.git/refs/heads/<branch-name>` chứa đúng chuỗi mã băm SHA của commit đỉnh nhánh.
- **Git biết commit nào thuộc về branch bằng Reachability**: Git bắt đầu từ commit đỉnh mà branch đang trỏ tới, rồi lần ngược qua chuỗi `parent` của từng commit cho tới Initial Commit hoặc Merge Base. Tập commit của một branch không được lưu sẵn; nó được suy ra bằng phép duyệt đồ thị: `reachable(feature_tip)`.
- **Commit mới luôn trỏ về commit cũ**: Khi tạo commit mới, commit mới lưu mã SHA của commit đang là `HEAD` làm `parent`. Commit cũ không biết gì về commit mới vì object cũ là bất biến.
- **Con trỏ `HEAD`**: Là con trỏ đặc biệt trỏ vào branch bạn đang làm việc (ví dụ: `ref: refs/heads/main`). Khi commit mới được tạo, Git cập nhật branch hiện tại để trỏ sang commit mới.
- **Trạng thái Detached HEAD**: Xảy ra khi bạn checkout trực tiếp vào một Commit SHA thay vì tên Branch (`git checkout <commit-hash>`). Lúc này `HEAD` trỏ thẳng vào commit nút, không có branch nào quản lý. Các commit tạo ra trong trạng thái này sẽ bị "mồ côi" nếu chuyển sang nhánh khác.

---

## Practical Implementation

### So sánh Thao tác trên Đồ thị DAG: Fast-Forward vs 3-Way Merge

| Thao tác                     | Hành vi trên Đồ thị DAG                                                            | Đặc tính lịch sử                          |
| :--------------------------- | :--------------------------------------------------------------------------------- | :---------------------------------------- |
| **Fast-Forward Merge**       | Chỉ cần di chuyển con trỏ Branch tiến về phía trước. Không tạo commit mới.         | Tuyến tính thẳng hàng (Linear).           |
| **Non-Fast-Forward (3-Way)** | Tạo một nút Commit mới trong DAG với 2 con trỏ cha (`Parent 1`, `Parent 2`).       | Giữ nguyên vết tích phân nhánh và hội tụ. |
| **Rebase**                   | Sao chép các commit cũ thành các nút commit MỚI (SHA mới) gắn vào đỉnh nhánh đích. | Viết lại lịch sử thành đường thẳng.       |

### Khôi phục sau Rebase nhầm

- **Sau rebase thành công**, commit cũ không bị xóa ngay. Các commit cũ chỉ trở thành **unreachable commits** nếu không còn branch/tag nào trỏ tới.
- **Không dùng `git reset HEAD~1` để quay lại trạng thái trước rebase**: `HEAD~1` chỉ lùi đúng 1 commit từ đỉnh hiện tại (ví dụ từ `C'` về `B'`), không quay về commit gốc `C` trước rebase.
- **Cách đúng**: Dùng `git reflog` để tìm vị trí cũ của branch trước rebase, rồi reset branch về đúng SHA đó:

```bash
git reflog
git reset --hard <old-feature-tip-sha>
```

- **Nếu rebase đang chạy dở và chưa hoàn tất**, dùng `git rebase --abort` để quay về trạng thái trước khi bắt đầu rebase.

---

## Related Notes

- [[Git_Conflict_and_Three_Way_Merge_Mechanics]]
- [[Git_Four_Zones_and_Reset_Lifecycle]]
- [[Stack_vs_Heap_Memory_Fundamentals]]
- [[000_Concepts_MOC]]
