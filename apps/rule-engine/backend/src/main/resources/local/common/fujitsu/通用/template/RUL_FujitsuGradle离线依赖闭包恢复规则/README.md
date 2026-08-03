# Fujitsu Gradle 离线依赖闭包恢复资产目录

## 主入口

- `../../rule/RUL_FujitsuGradle离线依赖闭包恢复规则.md`：组织级稳定约束，是当前模板材料对应的唯一主规则。

## 配套资产

- `docs/Gradle离线依赖恢复与正常测试执行说明.md`：人工执行说明和调用示例。
- `template/offline-test-init.gradle.template`：统一能力使用的源模板；`.template` 后缀避免 VS Code 把占位符当作可执行 Gradle 语法检查。

新增同主题公共说明、模板或样例时，只有经过核验且能稳定支持规则运行的真实材料才能收集到本目录；不得重新散放到已废弃的根级文档、模板或规则目录。真实项目配置必须进入对应项目的 `template/<规则名称>/`。
