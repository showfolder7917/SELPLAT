# MDA 多数据库工作台

MDA 用于保存数据库连接、浏览数据库元数据并执行页面提交的原始 SQL。

- 页面：`http://localhost:8082/mda/mda.html`
- 启动：`gradlew.bat --offline :apps:mda:backend:run`
- 测试：`gradlew.bat --offline :apps:mda:backend:test`
- 详细设计：`OPTION/MDA项目设计与迁移方案.md`

H2 驱动已经包含在工程离线缓存中。MySQL、SQL Server、Oracle、PostgreSQL 只需把组织批准的对应 JDBC 驱动 JAR 放入 `cache/cache-jars`，MDA 会按标准驱动文件名自动装载。
