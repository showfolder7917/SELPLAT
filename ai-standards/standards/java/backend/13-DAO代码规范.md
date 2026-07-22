# DAO 代码规范

定位：

- DAO 只承接单一领域的持久化读写边界
- DAO 是 Service 与 MyBatis Mapper XML 之间的稳定接口

要求：

- DAO 按领域拆分，不使用单一大而全 DAO
- 一个 DAO 只处理本领域主表和本领域强相关关系表
- DAO 接口命名以 `Dao` 结尾
- DAO 方法命名应直接表达查询、新增、更新、删除语义
- DAO 方法参数应尽量使用明确 `In` 模型或清晰参数，不传无语义大对象
- DAO 返回值应表达持久化结果，不夹带控制层展示结构

配套关系：

- 每个 DAO 应有对应 Mapper XML
- Mapper XML 与 DAO 方法应一一对应
- DAO 的真实样板写法可参照 `baselines/uniauth/DAO样板说明.md`
