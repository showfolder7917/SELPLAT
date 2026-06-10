# uniauth backend schema

这里放权限模块后端专属的数据库结构 SQL。

适合内容：

- 权限模块主表建表 SQL
- 关系表建表 SQL
- 权限模块初始化数据 SQL

放置原则：

- 只属于 `uniauth` 的表结构放这里。
- 真正跨模块复用的数据库公共能力，不放在这里，应进入 `shared/backend/common-db`。
