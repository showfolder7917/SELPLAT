# rule-engine manifest

这里仅保存 ruleengine 工程模块元数据 `module.json`。

AI Desktop 生产规则不再维护固定规则白名单或 JSON 覆盖文件。构建脚本从
`ruleengine/AGENTS.md` 解析唯一当前用户，再按该用户的递归索引树复制 Markdown；运行时同样
只允许当前用户层。新增或升级规则必须先进入当前用户索引，并经过规则包构建与真实安装产物检查。
