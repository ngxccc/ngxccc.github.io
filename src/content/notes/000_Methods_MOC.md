---
title: "Methods & Frameworks MOC"
description: "Bản đồ quy tụ các quy trình, thuật toán và framework thực chiến có thể lấy ra áp dụng ngay để giải quyết vấn đề (Actionable Toolbox). Tự động truy vấn dữ liệu động bằng DataviewJS."
date: "2026-04-29"
tags: ["type/moc", "topic/productivity"]
aliases: ["Methods Index", "Actionable Frameworks", "The Toolbox"]
domain: "Engineering"
sourcePath: "30_Resources/Methods/000_Methods_MOC.md"
---

# Methods & Frameworks MOC

## TL;DR

Bản đồ quy tụ các quy trình, thuật toán và framework thực chiến có thể lấy ra áp dụng ngay để giải quyết vấn đề (Actionable Toolbox). Tự động truy vấn dữ liệu động bằng DataviewJS.

---

```javascript
dv.header(2, "1. Engineering & Execution");
dv.table(
  ["Note Title", "Description"],
  dv
    .pages('"30_Resources/Methods/Engineering"')
    .where((p) => p.file.name !== "000_Methods_MOC")
    .sort((p) => p.file.name, "asc")
    .map((p) => [
      p.file.link,
      p.description ||
        (p.aliases ? (Array.isArray(p.aliases) ? p.aliases.join(", ") : p.aliases) : ""),
    ]),
);

dv.header(2, "2. Learning & Cognition");
dv.table(
  ["Note Title", "Description"],
  dv
    .pages('"30_Resources/Methods/Learning_and_Cognition"')
    .where((p) => p.file.name !== "000_Methods_MOC")
    .sort((p) => p.file.name, "asc")
    .map((p) => [
      p.file.link,
      p.description ||
        (p.aliases ? (Array.isArray(p.aliases) ? p.aliases.join(", ") : p.aliases) : ""),
    ]),
);

dv.header(2, "3. Finance & Wealth");
dv.table(
  ["Note Title", "Description"],
  dv
    .pages('"30_Resources/Methods/Finance"')
    .where((p) => p.file.name !== "000_Methods_MOC")
    .sort((p) => p.file.name, "asc")
    .map((p) => [
      p.file.link,
      p.description ||
        (p.aliases ? (Array.isArray(p.aliases) ? p.aliases.join(", ") : p.aliases) : ""),
    ]),
);

dv.header(2, "4. All Methods Index");
dv.table(
  ["Note Title", "Category", "Description"],
  dv
    .pages('"30_Resources/Methods"')
    .where((p) => p.file.name !== "000_Methods_MOC")
    .sort((p) => p.file.name, "asc")
    .map((p) => [
      p.file.link,
      p.file.folder.replace("30_Resources/Methods/", "").replace("30_Resources/Methods", "Root"),
      p.description ||
        (p.aliases ? (Array.isArray(p.aliases) ? p.aliases.join(", ") : p.aliases) : ""),
    ]),
);
```
