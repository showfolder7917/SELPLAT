# 南宫婉人物会话模块

南宫婉会话采用“公开门面 + 会话聚合根 + 按能力分组的内部服务”结构。调用方只依赖 `nangong.facade.ts` 或 `index.ts`，不直接读取 `internal`。

```text
nangong/
├─ domain/
│  └─ nangong-conversation.aggregate.ts
├─ internal/
│  ├─ application/
│  ├─ conversation/
│  ├─ distribution/
│  ├─ evolution/
│  └─ inquiry/
├─ nangong.facade.ts
└─ index.ts
```

`NangongConversationAggregate` 保存一次判断所需的会话属性，并把用户消息归并为唯一动作。它不调用 Codex、不写数据库，也不操作页面。

`internal/conversation` 执行动作并保存会话；`internal/inquiry` 负责事实核查；`internal/evolution` 负责提案编写；`internal/distribution` 负责审批后的任务分发；`internal/application` 只装配这些能力。

人物长期 Codex 连接由应用组合根登记到统一授权路由。南宫婉遇到命令或文件授权时，现有全局授权窗口会显示人物名称，南宫婉页面也会明确显示“等待授权”。
