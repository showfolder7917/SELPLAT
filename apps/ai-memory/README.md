# ai-memory 本地请求客户端

`ai-memory` 是 BAT 形式的 AI 工厂本地请求客户端。它主动轮询 AI 工厂的 HTTP API，按“阶段角色 → 已登记 Agent → 本地 Codex 连接”的顺序启动角色 Agent，并向 AI 工厂上报事实；自身不创建、不监听任何 HTTP 服务。

运行生成根固定为 `OPTION/temp/ai-factory`。源码目录只保存程序与正式资源。

```bat
apps\ai-memory\ai-memory.bat create --title "生成代码"
apps\ai-memory\ai-memory.bat once
apps\ai-memory\ai-memory.bat daemon
```

不传参数时默认执行 `daemon`。AI 工厂地址、连接池和轮询间隔在 `config/memory.toml` 配置；配置中的 `base_url` 是客户端请求目标，不是本地监听地址。长期令牌不得写入该文件。

BAT 优先使用环境变量 `SELPLAT_PYTHON` 指定的已验证解释器，未设置时尝试 `python`；禁止把某台机器的 Python 绝对路径写入工程。

Python 业务文件使用中文文件名，内部类、函数、参数和变量保持英文。启动协议、规则、索引、Agent 定义、配置和其他受管文件统一通过 `com/sp/selplat/core/文件读取器.py` 读取；Excel、Word、PDF 等解析能力后续按 Reader 扩展。
