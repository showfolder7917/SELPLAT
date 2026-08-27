# AI Desktop ruleengine

这里承载 SELPLAT 面向 AI 的规则驱动执行与持续规则包成长体系。

负责内容：

- 按稳定逻辑 ID 和当前作用域加载最少必要规则
- 按规则正文执行任务并完成偏差验证
- 维护规则、模板、案例、程序、验证和升级记录组成的规则包
- 通过 Java、Python、Node 原生能力完成可重复动作
- 将重复偏差沉淀为规则包升级，并形成 common 人工审查补丁

说明：

- 当前模式不是传统的解析器、裁决器和执行服务流水线。
- `local/core` 是冻结基线，`local/common` 只接受人工审查合并，自动修正进入已验证用户层。
- 规则数量增长不是目标；减少偏差、补全规则包和保持引用有效才是成长指标。

## 客户交付与运行方式

开发期完整规则库不会整体进入客户安装包。构建脚本只读取
`manifest/production-rules.json` 的显式白名单，生成 `build/ai-desktop/rule-bundle`，
Electron Builder 再把 `manifest.json` 和 `rules.json` 放到安装目录的
`resources/ruleengine/`。因此客户机器不需要 Python、不需要源码工程，也能使用产品规则。

主进程启动时校验每条内置规则的 SHA-256。Windows 客户若需要覆盖允许定制的规则，
可把 UTF-8 JSON 文件放到 `%APPDATA%\ai-desktop\ruleengine\overrides\`；文件格式参考
`manifest/customer-overlay.example.json`。覆盖只能使用内置清单中的稳定逻辑 ID，且该规则
必须标记 `customerOverridable=true`。未知规则、禁止覆盖规则、重复声明、超大或损坏文件会被
整文件拒绝，内置规则继续生效。

Renderer 只能读取规则状态和有效规则，不能写覆盖目录；Codex 会话读取主进程校验后的最终
规则正文。客户覆盖发生变化后，下一次启动会形成新的会话签名，不会沿用旧规则线程。
