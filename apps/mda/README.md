# MDA 多数据库工作台

MDA 用于保存数据库连接、浏览数据库元数据并执行页面提交的原始 SQL。

- 统一页面：`http://127.0.0.1:8080/mda/mda.html`
- 独立页面：`http://127.0.0.1:8082/mda/mda.html`
- 统一启动：`./gradlew --offline :apps:host:backend:run`
- 独立启动：`./gradlew --offline :apps:mda:backend:run`
- 测试：`./gradlew --offline :apps:mda:backend:test`
- 详细设计：`apps/mda/backend/doc/MDA项目设计与迁移方案.md`

MDA 控制库永久保存于 `apps/mda/db/mda.mv.db`；默认可查询工作库保存于
`apps/mda/db/mda-workspace.mv.db`。两者由 MDA 独立数据库上下文维护，不占用统一宿主的主数据源。

页面完全复用 `shared/frontend/sel-ui` 的五区面板、搜索、树、下拉、表格、窗口和主题系统。
点击左侧数据表会查询并显示前 1000 行；“SQL 查询”使用公共可移动、可缩放窗口。

H2 驱动已经包含在工程离线缓存中。MySQL、SQL Server、Oracle、PostgreSQL 只需把组织批准的对应 JDBC 驱动 JAR 放入 `cache/cache-jars`，MDA 会按标准驱动文件名自动装载。
