# 分包 04：memory 工作空间与执行详细设计

## 1. 计划文件

- `.../workspace/工作空间管理器.py`
- `.../workspace/产物存储器.py`
- `.../execution/Codex执行器.py`
- `.../codex/Codex连接池.py`
- `.../execution/任务调度器.py`
- `.../test/测试执行器.py`
- `.../test/证据存储器.py`
- `.../execution/修复协调器.py`

## 2. 方法合同

| DES ID | 文件 / 方法 | 作用与真实传参 | 真实返回 | 异常或副作用 |
| --- | --- | --- | --- | --- |
| DES-EXE-001 | `工作空间管理器.py::create(task,title,thread)->Workspace` | 输入 `TASK-10001`、“用户导入”、`10001`。 | `Workspace(path='OPTION/temp/ai-factory/任务/TASK-10001/工作空间',branch='feature/thread-10001')`。 | task_id 根已被其他任务占用或路径逃逸时抛 `WorkspaceConflict`。 |
| DES-EXE-002 | `工作空间管理器.py::acquire_write_set(run,paths)->WriteLease` | 输入计划写文件集合。 | `WriteLease(owner='RUN-1',paths=('apps/x/A.java',))`。 | 与其他运行重叠返回冲突，不并行写。 |
| DES-EXE-003 | `产物存储器.py::write_atomic(path,content)->ArtifactSnapshot` | 原子写需求文档 UTF-8 内容。 | `ArtifactSnapshot(size=2048,sha256='abc',version=1)`。 | 写失败保持旧文件；不产生半文件。 |
| DES-EXE-004 | `产物存储器.py::register(snapshot,type,context)->ArtifactFacts` | 登记 `DESIGN_DOCUMENT`。 | `ArtifactFacts(artifact_id='local:abc',relative_path='任务/TASK-10001/当前任务/详细设计/详细设计_V001.md')`。 | 禁止提交机器绝对路径或跨 task_id 路径。 |
| DES-EXE-005 | `Codex执行器.py::run(connection,context,prompt)->ProcessFacts` | 由对应角色 Agent 使用连接池中的独占 Codex 连接执行。 | `ProcessFacts(agent_id='DETAILED_DESIGN_AGENT',session_id='S-1',exit_code=0)`。 | 超时隔离连接；环境只传白名单，不记录令牌。 |
| DES-EXE-006 | `任务调度器.py::plan(tasks)->ExecutionPlan` | 输入 TASK-001 依赖空、TASK-002 依赖 TASK-001。 | `ExecutionPlan(waves=(('TASK-001',),('TASK-002',)))`。 | 依赖环抛 `TaskDependencyCycle`。 |
| DES-EXE-007 | `任务调度器.py::execute(plan)->tuple[TaskFacts,...]` | 按写集合串并行执行。 | 返回每项状态、输入摘要、输出摘要和耗时。 | 任一上游失败阻断依赖任务。 |
| DES-EXE-008 | `测试执行器.py::run(case)->TestEvidence` | 输入 `TEST-001`、命令、预期、脱敏数据。 | `TestEvidence(status='PASS',exit_code=0,actual='HTTP 201',digest='...')`。 | 命令未运行不能返回 PASS；超时返回 FAIL。 |
| DES-EXE-009 | `测试执行器.py::coverage(command,policy)->CoverageEvidence` | 输入普通模块阈值 85%。 | `CoverageEvidence(actual=87.4,required=85.0,status='PASS')`。 | 无批准例外且低于阈值返回 FAIL。 |
| DES-EXE-010 | `证据存储器.py::save(kind,payload)->EvidenceRef` | 保存测试 stdout/结构化结果到当前任务 `证据/`。 | `EvidenceRef(uri='local-evidence://TASK-10001/TEST-001',sha256='...')`。 | 敏感信息违规或目标不属于当前 task_id 时拒绝归档与上报。 |
| DES-EXE-011 | `修复协调器.py::classify(failure,evidence)->ClassificationRequest` | 提交 A/B/C/D 分类证据。 | `ClassificationRequest(fingerprint='fp-1',suggested_domain='A')`。 | 本地建议不直接成为权威分类。 |
| DES-EXE-012 | `修复协调器.py::apply(route,package)->FixFacts` | 按服务端路由执行 Code Fix。 | `FixFacts(attempt=1,changed=('A.java',),tests=('TEST-1',))`。 | 超范围生成 change request 并停止。 |
| DES-EXE-013 | `修复协调器.py::request_regate(facts,original_gate)->None` | 输入原 Gate `G005@1.0`。 | 无返回；outbox 写 `regate.requested`。 | 禁止换 Gate 或降低版本。 |
| DES-EXE-014 | `工作空间管理器.py::create_recovery_point(run)->RecoveryPoint` | 保存 Package、Git、产物和 outbox 游标。 | `RecoveryPoint(id='RP-1',git_revision='abc123')`。 | 不复制密钥；失败时任务进入人工核对。 |

## 3. Architecture Package 本地校验

执行前必须校验 task/run、角色与 Agent 登记摘要、Agent 地址、允许路径、禁止路径、必要测试、Gate、规则快照、风险、预算、有效期和审批摘要。任一字段缺失时 Python 不访问 Agent。

## 4. 生成物归属

任务文档使用 `当前任务/<阶段>/中文名称_VNNN.<ext>` 保存且不原地覆盖；Agent 会话、上下文、连接状态和心跳进入 `智能体/`；Gate 结果进入 `门禁/`；所有审计进入 `审计日志/`。交付前扫描 `apps/memory`、`apps/ai-factiory` 与 `OPTION/temp/ai-factory` 根，发现散落生成物即失败。
