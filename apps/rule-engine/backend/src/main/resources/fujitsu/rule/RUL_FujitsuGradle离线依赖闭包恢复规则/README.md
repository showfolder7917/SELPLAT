# Fujitsu Gradle 离线依赖闭包恢复规则包

## 主入口

- `RUL_FujitsuGradle离线依赖闭包恢复规则.md`：组织级稳定约束，是本规则包唯一主规则。

## 配套资产

- `docs/Gradle离线依赖恢复与正常测试执行说明.md`：人工执行说明和调用示例。
- `template/offline-test-init.gradle.template`：统一能力使用的源模板；`.template` 后缀避免 VS Code 把占位符当作可执行 Gradle 语法检查。
- `project/CPMAB082离线依赖配置.md`：CPMAB082 的只读参考工程和替代验证差异配置。

新增同主题说明、模板、样例或项目配置时必须继续放入本目录的标准子目录，不得重新散放到 `fujitsu/docs`、`fujitsu/template` 或其他规则目录。
