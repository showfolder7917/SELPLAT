# Fujitsu Gradle 离线依赖闭包恢复资产目录

## 主入口

- `../RUL_FujitsuGradle离线依赖闭包恢复规则.md`：组织级稳定约束，是当前资产目录对应的唯一主规则。

## 配套资产

- `docs/Gradle离线依赖恢复与正常测试执行说明.md`：人工执行说明和调用示例。
- `template/offline-test-init.gradle.template`：统一能力使用的源模板；`.template` 后缀避免 VS Code 把占位符当作可执行 Gradle 语法检查。

新增同主题公共说明、模板或样例时必须继续放入本目录的标准子目录，不得重新散放到 `fujitsu/docs`、`fujitsu/template` 或其他规则目录。真实项目配置必须进入对应项目主规则的同名资产目录。
