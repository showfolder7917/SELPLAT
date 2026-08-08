# uniauth backend

这里放权限模块后端实现。

适合内容：

- 用户管理接口
- 角色与菜单接口
- 租户管理接口
- 权限装配业务逻辑
- 权限模块专属 schema 与初始化 SQL

当前子目录建议：

- `schema/`
  放权限模块专属表结构 SQL 与初始化 SQL。

当前状态：已开始补权限模块数据库骨架。

## 数据库边界

- Uniauth 使用模块私有永久数据库 `apps/uniauth/db/uniauth.mv.db`。
- 本地数据库账号为 `sa`，默认密码为 `123456`。
- `UniauthPersistenceConfiguration` 创建 `UniauthPool`、执行 `schema-uniauth.sql` 与 `data-uniauth.sql`。
- `UniauthBaseDao` 只读取具名的 `uniauthBaseDataSourceContext`，不会回退到 Host 或其他模块数据源。
- Host 只导入模块配置和页面，不再通过全局 `spring.datasource` 持有 Uniauth 数据库。
- 自动测试由 `src/test/resources/application.properties` 强制切换到隔离 H2 内存库，禁止读写永久文件。
