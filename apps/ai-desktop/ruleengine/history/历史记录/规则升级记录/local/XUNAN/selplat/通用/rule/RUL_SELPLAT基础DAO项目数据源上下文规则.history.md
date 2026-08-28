# RUL_SELPLAT基础DAO项目数据源上下文规则 升级历史

> 可丢失历史记录：本文件不是规则、索引、程序、测试或构建输入；当前有效约束只以正式规则正文为准。

<!-- 升级记录说明本规则来自 Uniauth 多项目数据源继承修正。 -->
upgrade_record = 2026-08-07:公共BaseDAO改为项目数据源上下文并由Uniauth项目基类首个接入;2026-08-07:Uniauth增加数据库元数据默认表格定义及未来reference-data配置优先入口;2026-08-08:Uniauth退出Host全局数据源并建立模块私有永久数据库和隔离测试库;2026-08-08:删除业务Service中无调用方的旧主键重载与只调用super的重复覆盖;2026-08-08:MDA与Uniauth号段DAO改按项目具名数据源注册并由公共发号器按真实seqCode唯一路由;2026-08-11:reference-data建立一行一列的数据库驱动页面表格头并由真实页面消费;2026-08-11:表格头坐标改为tableName_gridId_gridColumnId并补齐数据库字段_单元格渲染_图标_审计职责;2026-08-11:getGridColumn统一本地Provider_远程HTTP_字段名静默降级且返回同一列数组;2026-08-11:受管业务应用统一具名Hikari私有池并由快速门禁阻断DriverManagerDataSource等逐次建连退化;2026-08-12:租户与操作员身份统一由BaseServiceImpl覆盖且前端禁止提交

<!-- 本次升级明确单行列不得因空第二字段继续使用 stack，页面显示顺序必须由表格头记录明确表达。 -->
upgrade_record_20260816_grid_single_and_compound_column = 单值列text且secondaryFieldName为空_组合列stack且第二字段真实存在_页面列顺序由sortnum稳定表达

<!-- 本次升级固定大数据列表查询必须使用独立字段和 BaseDao AND 条件，不再全量加载后前端过滤。 -->
upgrade_record_20260816_backend_paging_query = 查询字段独立输入_BaseDao字段条件AND组合_后台返回当前页和总数_禁止跨列OR关键字与全量前端过滤
