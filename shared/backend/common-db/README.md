# common-db

这里放后端数据库公共能力。

适合内容：

- 分页基类
- 审计字段支持
- 基础持久化工具
- 公共数据库配置适配
- 公共 DAO 接口模板

当前状态：

- `com.sp.selplat.common.db.dao.BaseDao`
  - 提供通用列表查询、扩展字段查询、总数查询、新增、更新、按主键查询、按主键删除、按字段模糊查询的接口模板
- `com.sp.selplat.common.db.dao.BaseTemplateDao`
  - 提供 `@Select/@Insert/@Update/@Delete` 级别的动态表名公共模板，适合快速落后台通用数据访问
- `com.sp.selplat.common.db.domain.CommonLikeQuery`
  - 提供公共模糊查询入参，统一字段名和值的传递口径
- `com.sp.selplat.common.db.domain.CommonTemplateQuery`
  - 提供注解式模板的等值查询入参
- `com.sp.selplat.common.db.domain.CommonTemplateLikeQuery`
  - 提供注解式模板的模糊查询入参
- `com.sp.selplat.common.db.domain.CommonTemplateSaveIn`
  - 提供注解式模板的新增入参
- `com.sp.selplat.common.db.domain.CommonTemplateUpdateIn`
  - 提供注解式模板的更新入参

使用约束：

- 业务 DAO 继续按领域拆分，不做跨领域大而全 DAO
- 业务模块继承 `BaseDao` 后，仍可保留自身领域专属方法
- `selectListByLike` 中的字段名必须由业务模块在 XML 中按白名单映射，不能直接透传任意列名
- `BaseTemplateDao` 直接使用 `${tableName}`、`${fieldName}`、`${entry.key}` 这一层动态拼接能力，只适合后端白名单字段和受控后台场景，不能直接暴露给前端任意透传
