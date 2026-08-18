# Fujitsu Python 规则工具

正式入口：

`apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/fujitsu_excel_tools.py`

该入口统一提供 SQL 规格书生成与修正、工作簿和 CSV 相互导入导出、API 概要和接口规格生成。依赖统一登记在 `apps/rule-engine/backend/requirements-python.txt`，解释器通过 `-PselplatPython` 或 `SELPLAT_PYTHON` 配置。

模板、JSON 配置、参考工作簿和说明文档继续保存在当前规则包内；生成物写入显式输出位置，不写回模板。
