# 分包 02：memory 常驻入口与 Agent 详细设计

## 1. 计划文件

- `.../启动入口.py`
- `.../daemon/常驻驱动器.py`
- `.../daemon/任务监听器.py`
- `.../registry/角色智能体解析器.py`
- `.../agent/智能体启动器.py`
- `.../agent/智能体调度器.py`
- `.../codex/Codex连接池.py`
- `.../agent/阶段执行器.py`
- `.../agent/上下文构建器.py`
- `.../requirement/需求分析器.py`

## 2. 驱动模型

Python 常驻进程是唯一主动驱动者。角色、Agent、角色与 Agent 的绑定、Agent 地址、协议、版本和能力登记在 ai-factory；memory 只读取服务端冻结登记，获取短期授权后访问并启动对应 Agent。Java 和可视化页面均不得主动启动 Agent 或越过 Python 推进流程。

```text
MemoryDaemon监听任务
→ 获取阶段角色
→ 解析已登记Agent及地址
→ 从本地Codex连接池取得连接
→ 启动/恢复对应角色Agent
→ Agent驱动Codex、工具、Gate或测试
→ Python通过HTTP上报进度、产物、审计和状态请求
```

## 3. 方法合同

| DES ID | 文件 / 方法 | 作用与真实传参 | 真实返回 | 异常或副作用 |
| --- | --- | --- | --- | --- |
| DES-MEM-001 | `启动入口.py::main(argv:list[str])->int` | 解析 `['daemon','--project','SELPLAT']` 并启动常驻进程。 | 启动成功返回 `0`。 | 配置或 API 版本不兼容返回 `2`；不启动 Agent。 |
| DES-MEM-002 | `任务受理器.py::create_intake(title,project,source_text)->TaskContext` | 通过 HTTP 创建根任务；示例标题“用户导入”。 | `TaskContext(task_id='TASK-10001',root_thread_id='10001',stage_run_id='RUN-1')`。 | 服务不可用只在任务根写未登记草稿，不创建正式阶段。 |
| DES-MEM-003 | `需求分析器.py::produce_requirement(context,materials)->ArtifactDraft` | 已解析的 REQUIREMENT_AGENT 驱动 Codex 整理需求。 | `ArtifactDraft(path='当前任务/需求文档/需求文档_用户导入_V001.md',sha256='...')`。 | 重大歧义上报 BLOCKED，不提交完成。 |
| DES-MEM-004 | `需求分析器.py::produce_items(requirement)->list[RequirementItem]` | REQUIREMENT_ANALYST_AGENT 在需求确认后继续拆成稳定要件；页面按一个按钮动作、批处理按一次启动调用、监听程序按一次事件处理调用拆分。 | `[RequirementItem(id='REQ-REQ-001',entry='创建按钮',verification='事务顺序测试')]`。 | 一个要件包含多个独立功能、重复 ID、缺验收或验证方式时阻断。 |
| DES-MEM-005 | `需求分析器.py::submit_items(context,artifact,items)->SubmissionReceipt` | 同一个需求分析 Agent 上报文件摘要和要件集合。 | `SubmissionReceipt(accepted=True,artifact_version=1,gate_status='PENDING')`。 | 409 时保留任务目录版本并重新对账。 |
| DES-MEM-006 | `角色智能体解析器.py::get_stage_role(stage_id)->RoleSnapshot` | 从 ai-factory 获取 `STAGE-DESIGN` 冻结角色。 | `RoleSnapshot(role_id='DETAILED_DESIGN_ROLE',version='1.0',digest='abc')`。 | 未批准或摘要缺失时禁止解析 Agent。 |
| DES-MEM-007 | `上下文构建器.py::build_context(stage,role,agent,package)->AgentContext` | 合并阶段、角色、Agent、治理快照和 Package。 | `AgentContext(task_root='OPTION/temp/ai-factory/任务/TASK-10001',allowed_paths=(...))`。 | 任何路径不属于 task_id 根时 BLOCKED。 |
| DES-MEM-008 | `阶段执行器.py::claim_stage(stage_id)->StageLease` | Python 调 HTTP 领取阶段。 | `StageLease(run_id='RUN-1',expires_at='2026-08-19T10:10:00+09:00')`。 | 409 时不访问 Agent。 |
| DES-MEM-009 | `阶段执行器.py::run_stage(lease,context)->RunFacts` | 调度已解析的单一角色 Agent。 | `RunFacts(agent_id='DETAILED_DESIGN_AGENT',exit_code=0,artifacts=('ART-1',))`。 | 租约失效停止新动作、保存恢复点并上报事实。 |
| DES-MEM-010 | `阶段执行器.py::heartbeat(lease,action,percent)->None` | 示例 `action='生成详细设计',percent=35`。 | 无返回；先写任务审计，再进入 outbox。 | 网络失败不把百分比当权威状态。 |
| DES-MEM-011 | `阶段执行器.py::complete(lease,facts)->CompletionReceipt` | Python 提交实际产物与执行事实。 | `CompletionReceipt(status='WAITING_FILE_GATE')`。 | Java拒绝时本地不得标记完成。 |
| DES-MEM-012 | `阶段执行器.py::block(lease,code,evidence)->None` | 示例 `code='REQUIREMENT_AMBIGUOUS'`。 | 无返回；通过 HTTP 请求进入等待人工。 | 停止当前 Agent 并保存证据摘要。 |
| DES-MEM-013 | `常驻驱动器.py::serve(stop_event)->None` | 启动监听、连接池、调度器、同步器和本地看门狗。 | 运行至收到受控停止信号。 | 单实例锁失败不启动第二个 daemon。 |
| DES-MEM-014 | `任务监听器.py::listen(cursor)->Iterator[TaskEvent]` | 以 SSE/轮询监听 cursor=18。 | 返回序号 19 的 `stage.ready`。 | 断线先取快照再续传，不自行创造任务。 |
| DES-MEM-015 | `角色智能体解析器.py::resolve_agent(role)->AgentRegistration` | 查询角色绑定的已批准 Agent。 | 返回 agentId/version/endpointType/endpoint/capabilities/digest。 | 多个活动绑定、协议不兼容或地址缺失时 BLOCKED。 |
| DES-MEM-016 | `Codex连接池.py::acquire(registration,run_id)->AgentConnection` | 访问 `codex://agents/detailed-design`。 | 返回绑定 runId 的独占连接。 | 池满时排队；禁止把同一会话并发交给两个运行。 |
| DES-MEM-017 | `智能体启动器.py::start(registration,connection,context)->AgentHandle` | 用短期授权启动 DETAILED_DESIGN_AGENT。 | 返回 pid/session/thread/startedAt。 | Agent 地址只能由登记解析；启动失败写任务审计并上报。 |
| DES-MEM-018 | `智能体调度器.py::dispatch(event)->AgentHandle` | 根据阶段依赖、角色和写集合调度 Agent。 | 返回唯一 agent/run 绑定。 | 不允许页面或 Java绕过 Python 调度。 |
| DES-MEM-019 | `Codex连接池.py::release(handle,outcome)->None` | Agent结束后清理上下文和连接占用。 | 无返回；保留脱敏会话摘要。 | 未确认副作用的连接进入隔离区，不立即复用。 |
| DES-MEM-020 | `常驻驱动器.py::watch_leases(now)->tuple[LeaseAlert,...]` | 本地检查心跳与租约并调用 HTTP 请求状态核对。 | 返回待处理过期运行列表。 | Java不主动扫描；Python也不能未经 API 校验直接改权威状态。 |

## 4. 每角色一 Agent

需求分析 Agent 通过 `core/IDX_核心总索引.md` 进入固定启动链，同时承担需求文档与需求要件。一个需求要件对应一个可独立开发、调用、测试和验收的功能；页面按钮、批处理调用和监听事件处理分别作为拆分入口。架构、详细设计、实现、测试、Gate、修复、进化、支撑和发布材料分别登记稳定 `role_id` 与 `agent_id`。一次运行只能绑定一个角色和一个 Agent；父调度器只派发结构化任务，不把自己的文本结论当作子 Agent 或 Gate 证据。

每个 Agent 运行必须绑定：`task_id`、`stage_id`、`run_id`、`role_id/version/digest`、`agent_id/version/digest`、`endpoint`、`thread_id`、权限、允许路径、治理快照、预算、租约和审计序号。

## 5. 地址与凭据

ai-factory 返回地址类型、逻辑地址和短期授权，不返回长期凭据。MVP 支持 `LOCAL_CODEX` 与 `HTTP_AGENT`；本地 Codex 使用类似 `codex://agents/detailed-design` 的逻辑地址，由 Python 映射到连接池，禁止把机器绝对路径登记为 Agent 地址。
