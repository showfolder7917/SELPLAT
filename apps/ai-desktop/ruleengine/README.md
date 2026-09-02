# AI Desktop ruleengine

这是 AI Desktop 内嵌的 Python 规则工程，不是独立后端、Gradle 子项目或 HTTP 服务。

## 目录

- `python/ruleengine/`：统一执行器、生命周期管理器和规则快照等运行能力。
- `python/local/core/`：冻结的核心 Python 能力。
- `python/local/<stable-user-id>/`：从 `ruleengine/AGENTS.md` 解析的当前用户能力。
- `rules/`：唯一规则索引、协议、分层规则、注册表和路径配置。
- `tests/local/`：按 core 与当前用户分层的 Python 测试。
- `manifest/`：ruleengine 模块元数据。

架构方案和目录职责文档统一保存在工程根 `OPTION/`；ruleengine 内不再保留已退役的设计副本。

项目不再使用 `backend/src/main|test` 和 `com/sp/selplat` 式目录。Python 导入根是
`python/`，包名使用 `ruleengine`、`local.core` 和 `local.<stable-user-id>`。

## 运行与测试

- 启动协议：`python apps/ai-desktop/ruleengine/python/local/core/abilities/startup_protocol_loader.py`
- 能力执行：`python apps/ai-desktop/ruleengine/python/ruleengine/执行器.py <ability_name> <context_json>`
- 统一测试：`python apps/ai-desktop/ruleengine/tests/run_tests.py all`

Python 缓存统一写入工程 `cache/python-pycache`，源码目录不得出现 `__pycache__` 或 `.pyc`。

## 客户交付

`apps/ai-desktop/scripts/build-rule-bundle.mjs` 从 `ruleengine/AGENTS.md` 解析当前用户，只把
统一入口、根索引和该用户的完整 Markdown 索引树写入 `build/ai-desktop/rule-bundle`，并排除
core、common、其他用户、会话、历史和模板。Electron Builder 将该快照放入安装目录
`resources/ruleengine/`，客户机器不需要 Python 或源码工程也能初始化本地规则工作区。

无源码模式的后续修改只写 `userData/rule-workspace/rules/local/<active-user>/`；修改后生成
带 SHA-256 清单的 ZIP 进入 `upload-outbox`，启动时通过可替换上传端口异步尝试一次。
