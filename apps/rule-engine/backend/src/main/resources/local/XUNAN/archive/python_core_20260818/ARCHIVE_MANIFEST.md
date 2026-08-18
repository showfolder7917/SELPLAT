# Python core 迁出封存清单

<!-- 本封存批次来自 2026-08-18 的 Python core 第一版结构收敛。 -->
archive.batch = python_core_20260818

<!-- 封存内容不参与生产加载。 -->
archive.runtime_status = disabled

<!-- 封存内容不得登记到 active ability 注册表。 -->
archive.ability_registry = forbidden

<!-- 封存规则不得登记到根索引、common 索引或当前用户 active 索引。 -->
archive.rule_index = forbidden

<!-- active 代码不得导入封存模块。 -->
archive.active_code_import = forbidden

<!-- 封存内容恢复前必须重新核对调用方、依赖、规则归属和测试。 -->
archive.restore_gate = callers_dependencies_rules_and_tests_review

<!-- 记账地址不存在，因此两个记账提交能力已经退役。 -->
archive.ledger_submitter_status = retired_no_endpoint

<!-- 经验查询桥没有 active 生产调用方，因此已经退出生产加载。 -->
archive.experience_query_bridge_status = retired_no_active_caller

## 代码映射

| 原 core 内容 | 封存位置 | 停用原因 |
|---|---|---|
| `abilities/gui_human_like_delivery.py` | `abilities/gui_human_like_delivery.py` | GUI 自动化不是启动内核 |
| `abilities/h2_query_workbench_delivery.py` | `abilities/h2_query_workbench_delivery.py` | H2 工作台属于领域工具 |
| `abilities/mp4_to_transparent_png_sequence_delivery.py` | `abilities/mp4_to_transparent_png_sequence_delivery.py` | 媒体转换不是启动内核 |
| `abilities/page_visual_tester.py` | `abilities/page_visual_tester.py` | 页面验证改用当前环境浏览器能力 |
| `abilities/project_text_replace_unifier.py` | `abilities/project_text_replace_unifier.py` | 无 active 生产调用方 |
| `abilities/vob_to_mp4_delivery.py` | `abilities/vob_to_mp4_delivery.py` | 媒体转换不是启动内核 |
| `abilities/ledger_http_submitter.py` | `abilities/ledger_http_submitter.py` | 已无可用记账地址 |
| `abilities/ledger_utf8_submitter.py` | `abilities/ledger_utf8_submitter.py` | 唯一 HTTP 依赖已退役 |
| `abilities/experience_query_bridge.py` | `abilities/experience_query_bridge.py` | 无 active 生产调用方，经验查询入口停用 |
| `skill/ffmpeg_*.py` | `util/ffmpeg_*.py` | 只服务封存媒体能力 |
| `skill/launch_gui_app_with_plan.py` | `util/launch_gui_app_with_plan.py` | 只服务封存 GUI 能力 |
| `app/h2_query_workbench/` | `app/h2_query_workbench/` | 与 H2 delivery 原子封存 |
| `app/vob_to_mp4_gui_pyside6.py` | `app/vob_to_mp4_gui_pyside6.py` | 与媒体 delivery 原子封存 |

## 规则与测试映射

| 原内容 | 封存位置 | active 替代关系 |
|---|---|---|
| `local/core/rule/GUI_VIDEO_TASK_RULES.md` | `rule/GUI_VIDEO_TASK_RULES.md` | 根索引登记已删除 |
| `core/tests/test_page_visual_tester.py` | `XUNAN/archive/python_core_20260818/tests/test_page_visual_tester.py` | 不进入统一测试发现目录 |
| `core/tests/test_ledger_http_submitter.py` | `XUNAN/archive/python_core_20260818/tests/test_ledger_http_submitter.py` | 不进入统一测试发现目录 |
| `core/tests/test_ledger_utf8_submitter.py` | `XUNAN/archive/python_core_20260818/tests/test_ledger_utf8_submitter.py` | 不进入统一测试发现目录 |
| `core/tests/test_experience_query_bridge.py` | `XUNAN/archive/python_core_20260818/tests/test_experience_query_bridge.py` | 不进入统一测试发现目录 |

## 本批迁出项

`gradle_offline_test_restorer.py` 已更名为 `fujitsu_gradle_offline_test_restorer.py` 并迁入当前用户 `abilities/`；关联规则和模板迁入当前用户 Fujitsu 作用域，core 注册及 common 旧入口已经删除。
