# SQL 仕様書 Python 生成工具

统一入口：

`apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/fujitsu_excel_tools.py`

生成命令采用 `sql-generate` 子命令，依次传入输出工作簿和一个或多个 Mapper XML / Java 注解源文件；可用 `--config` 与 `--template` 显式指定规则包配置和参考模板。

修正既有工作簿采用 `sql-correct` 子命令，并分别传入源工作簿和新输出工作簿。工具禁止覆盖输入文件，正式结果必须经过可打开性、Sheet、SQL 正文、动态标签、打印和样式检查。
