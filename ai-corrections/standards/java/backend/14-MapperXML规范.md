# Mapper XML 规范

职责：

- 承接 DAO 方法对应的 SQL 实现
- 保持和表结构、DAO、Service 一致

要求：

- Mapper XML 与 DAO 一一对应
- SQL 语义按领域收敛，不跨多个无边界业务域
- 字段别名、结果映射和驼峰转换规则保持统一
- 主键回填、唯一约束依赖和关系表写入要与 Service 逻辑一致
