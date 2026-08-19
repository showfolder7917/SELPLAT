# memory 本地驱动

`memory` 是 AI 工厂唯一主动驱动端。它在本机常驻监听 Java 控制面的就绪阶段，按“阶段角色 → 已登记 Agent → 本地 Codex 连接”的顺序启动角色 Agent，并在任务目录内保存完整审计与证据。

运行生成根固定为 `OPTION/temp/ai-factory`。源码目录只保存程序与正式资源。

```bash
PYTHONPATH=apps/memory/src/main/python python3 -m com.sp.selplat.memory.启动入口 create --title "生成代码"
PYTHONPATH=apps/memory/src/main/python python3 -m com.sp.selplat.memory.启动入口 once
PYTHONPATH=apps/memory/src/main/python python3 -m com.sp.selplat.memory.启动入口 daemon
```

服务地址、连接池和轮询间隔在 `config/memory.toml` 配置。长期令牌不得写入该文件。

Python 业务文件使用中文文件名，内部类、函数、参数和变量保持英文。启动协议、规则、索引、Agent 定义、配置和其他受管文件统一通过 `com/sp/selplat/core/文件读取器.py` 读取；Excel、Word、PDF 等解析能力后续按 Reader 扩展。
