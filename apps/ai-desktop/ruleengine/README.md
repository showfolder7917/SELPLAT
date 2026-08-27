# AI Desktop ruleengine

这是 AI Desktop 内嵌的 Python 规则工程，不是独立后端、Gradle 子项目或 HTTP 服务。

## 目录

- `python/ruleengine/`：统一执行器、生命周期管理器和规则快照等运行能力。
- `python/local/core/`：冻结的核心 Python 能力。
- `python/local/<stable-user-id>/`：从根 `AGENTS.md` 解析的当前用户能力。
- `rules/`：唯一规则索引、协议、分层规则、注册表和路径配置。
- `tests/local/`：按 core 与当前用户分层的 Python 测试。
- `manifest/`：客户规则白名单、覆盖示例和模块元数据。

架构方案和目录职责文档统一保存在工程根 `OPTION/`；ruleengine 内不再保留已退役的设计副本。

项目不再使用 `backend/src/main|test` 和 `com/sp/selplat` 式目录。Python 导入根是
`python/`，包名使用 `ruleengine`、`local.core` 和 `local.<stable-user-id>`。

## 运行与测试

- 启动协议：`python apps/ai-desktop/ruleengine/python/local/core/abilities/startup_protocol_loader.py`
- 能力执行：`python apps/ai-desktop/ruleengine/python/ruleengine/执行器.py <ability_name> <context_json>`
- 统一测试：`python apps/ai-desktop/ruleengine/tests/run_tests.py all`

Python 缓存统一写入工程 `cache/python-pycache`，源码目录不得出现 `__pycache__` 或 `.pyc`。

## 客户交付

开发期规则源不会直接复制给客户。`apps/ai-desktop/scripts/build-rule-bundle.mjs` 只读取
`manifest/production-rules.json` 白名单，从 `rules/` 生成
`build/ai-desktop/rule-bundle`。Electron Builder 将 `manifest.json` 与 `rules.json`
放入安装目录 `resources/ruleengine/`，所以客户机器不需要 Python 或源码工程也能使用规则。

Windows 客户规则覆盖位于 `%APPDATA%\ai-desktop\ruleengine\overrides\`，格式参考
`manifest/customer-overlay.example.json`。覆盖只能使用白名单中的稳定逻辑 ID，并在主进程
完成大小、重复项、权限和 SHA-256 校验后生效。
