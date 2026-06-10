# Java 规范

这里放给 AI 使用的 Java 通用规范、后端分层规范、迁移规范、样板基线说明和同步修正清单。

定位：

- 约束 Java 代码在 `SELPLAT` 中的统一写法
- 约束 Java 后端的分层边界和持久化边界
- 约束旧工程模块迁移到新平台时的步骤和检查清单
- 给 AI 提供可复用的样板模块参考

目录分层：

- `platform/`：平台级通用规范
- `backend/`：后端分层代码规范
- `migration/`：模块迁移规范
- `baselines/`：样板模块基线
- `sync/`：规范自身的修正索引与检查清单

当前建议优先阅读顺序：

1. `索引.md`
2. `platform/00-Java总则.md`
3. `backend/13-DAO代码规范.md`
4. `backend/14-MapperXML规范.md`
5. `backend/11-Service代码规范.md`
