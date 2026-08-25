# AI Desktop SQLite 运行库

`ai-memory-paths.json` 是数据库位置的唯一配置。开发启动和 Developer 打包版都通过 `AiMemoryPathResolver` 读取它，不得回退到 Electron `userData` 或缓存目录建立第二份数据库。

## Git 边界

- 提交：路径配置、本说明、`sql/load-order.txt` 和所有已发布 SQL。
- 不提交：`events.sqlite3`、`events.sqlite3-wal`、`events.sqlite3-shm`。
- 已发布 SQL 不得修改；变更结构必须追加新版本并更新加载清单。

## 启动和恢复

- 真正首次启动可以创建 `events.sqlite3`，并在单个事务内建立版本表。
- 已完成初始化后数据库丢失、损坏、迁移校验和不一致时，数据库业务进入恢复状态；程序不会删除现场或偷偷生成空库。
- 正常退出会先执行 WAL checkpoint，再关闭唯一主进程连接。

## 统一工作流

- `AiDesktopEvent` 是全部人物、系统、启动器和任务的统一事件入口，区分技术异常、业务异常和卡住。
- `AiDesktopWorkflowRun` 保存南宫婉演化、令狐持续保障和普通协同流程。
- `AiDesktopTaskExecution`、`AiDesktopMemberRuntime` 保存任务状态、成员心跳、超时、恢复点和验收结果。
- `AiDesktopApprovalRecord` 保存韩立与用户的审批事实、建议和参考历史。
- `AiDesktopRuntimeSession` 在下次启动时识别上一次未正常结束的运行，并生成恢复事件。
- 主进程监督器每 30 秒同步状态；执行中任务连续 120 秒没有有效进展时只登记一次卡住事实，再交给令狐现有恢复入口处理。
