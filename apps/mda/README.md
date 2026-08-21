# MDA 多数据库工作台

MDA 是只在本地开发环境使用的多数据库管理工具：它在自己的控制库中维护连接配置，再按当前选中的配置动态连接目标数据库，浏览元数据并执行查询或修改 SQL。

- 统一页面：`http://127.0.0.1:8080/mda/mda.html`
- 独立页面：`http://127.0.0.1:8082/mda/mda.html`
- 统一启动：`./gradlew --offline :apps:host:backend:run`
- 独立启动：`./gradlew --offline :apps:mda:backend:run`
- 离线测试：`./gradlew --offline :apps:mda:backend:test`

## 数据边界

- 唯一控制库：`apps/mda/db/mda.mv.db`，只在本地持久化且不提交 Git；版本交付以 `db/sql/**` 为准。
- 控制表：`MdaConnectionProfile`，保存目标库类型、地址、账号和明文密码。
- 不再创建旧版 MDA 默认工作库；内置 Reference Data、日语题库和 AI 工厂数据库连接，其他目标库由用户在页面新增。
- 删除连接配置只会逻辑删除控制表记录，不会删除目标数据库或目标数据。
- MDA 控制库保持为模块私有 JDBC 上下文，不占用统一宿主的主数据源。

页面复用 `shared/frontend/sel-ui` 的面板、搜索、树、下拉、表格、可拖拽缩放窗口和主题系统。连接新增、编辑和删除同样使用公共窗口与公共下拉组件。

H2 驱动已在离线依赖中。MySQL、SQL Server、Oracle 和 PostgreSQL 需要把组织批准的 JDBC 驱动放入 `cache/cache-jars`。
