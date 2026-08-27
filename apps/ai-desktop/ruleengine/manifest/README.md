# rule-engine manifest

这里放规则引擎声明文件。

建议内容：

- `module.json`
- `routes.json`
- `permissions.json`
- `dependencies.json`

当前正式声明：

- `module.json`：ruleengine 工程模块元数据。
- `production-rules.json`：唯一生产规则白名单，决定哪些规则进入客户包以及是否允许覆盖。
- `customer-overlay.example.json`：客户覆盖格式示例，不进入安装包运行资源。

禁止通过扫描 `backend/src/main/resources` 自动决定生产规则。新增生产规则必须先登记稳定逻辑
ID、明确客户是否可覆盖，再经过规则包构建和真实安装产物检查。
