# 需求分析师启动链

所有文件必须由 `com/sp/selplat/core/文件读取器.py` 读取，禁止调用方自行打开文件或扫描目录猜测入口。

固定加载顺序：

1. 用户协作协议：`apps/ai-memory/src/main/resources/core/启动链/USER.PROTOCOL.md`
2. 核心规则索引：`apps/ai-memory/src/main/resources/core/规则/IDX_核心规则总索引.md`
3. 需求分析师定义：`apps/ai-memory/src/main/resources/memory/智能体/AGENT_需求分析师.md`
4. 用户原始需求与已确认补充材料。
5. 生成需求文档。
6. 按独立开发功能拆分需求要件。

任一链路文件缺失、读取失败、顺序不一致或规则索引失效时必须停止，不得跳过后继续生成。
