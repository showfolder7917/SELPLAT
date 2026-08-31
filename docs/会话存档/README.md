# 会话存档

本目录是外部 Codex 按用户明确命令保存会话的临时文件存储区。

- 不存在后台监听、定时任务或 AI Desktop 自动保存；只有用户明确要求“保存会话”时，外部 Codex 才执行存档能力。
- 每个 `会话_<conversationId>.json` 对应一个外部 Codex 会话。
- 文件编码固定为 UTF-8，格式由 `schemaVersion` 标识。
- `turns` 保存真实可见的用户消息和 Codex 最终回答，并单独保存已有的 `SELPLAT_CORPUS_META`；不保存系统提示、工具输出、隐藏推理或 commentary。
- 手动保存发生时仍未结束的末轮标记为 `incomplete`，以后再次手动保存会更新同一个文件。
- `migration.status` 为 `pending` 时，表示该文件仍需导入统一会话训练库。
- 即使数据库已经存在，也禁止自动导入；只有用户以后明确要求“导入会话存档”时才执行数据库导入。
- 运行时会话文件默认不进入 Git，避免把用户对话意外提交到代码仓库。

未来导入器应以 `conversationId`、`turnId` 和 `messageId` 作为幂等键；导入成功后再更新迁移状态或将文件移动到明确的已导入归档区。
