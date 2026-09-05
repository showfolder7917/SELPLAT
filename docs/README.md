AI工程架构
原则
边界之间解耦、边界内部聚合，高内聚 低耦合

边界划分
1按照UI界面划分 1个界面 1个边界
2 按照模块划分 1个模块 1个边界

存放定义
DTO：数据格式
Domain：状态 + 规则
Service：流程调度
Repository：数据保存
Facade：对外入口

类型	关注点	调用方看到什么
Repository	领域对象	像操作任务、提案、卡点聚合
Store	数据和状态	像读取、替换、提交一份状态
DAO	数据库表	SQL 行、字段、增删改查

Service
   ↓
Repository 接口
   ↓
Repository 实现
├─ Store：内存/JSON状态
└─ DAO：SQLite表操作

Domain 经过这次重构已经开始清晰。
DTO 的位置也是明确的。
Service 的调度职责基本明确。
Repository / Store / DAO 这一段还没有形成统一标准。