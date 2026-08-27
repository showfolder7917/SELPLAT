# 分包 03：memory 本地规则工厂详细设计

## 1. 计划文件

- `已退役本地驱动应用/src/main/python/com/sp/selplat/memory/rulefactory/规则编写器.py`
- `.../规则索引器.py`
- `.../门禁定义器.py`
- `.../门禁执行器.py`
- `.../流程提案器.py`
- `.../治理包构建器.py`
- `.../快照存储器.py`

固定模板与正式只读资源统一放在 `已退役本地驱动应用/src/main/resources/memory/` 下的 `规则/`、`门禁/`、`入口/`、`智能体/`；任务运行生成的 `RUL_中文`、`GATE_中文`、`IDX_中文`、候选包、样例和证据只能写入 `OPTION/temp/ai-factory/任务/<task_id>/治理候选/` 或同任务的 `门禁/`。顶层 `治理/` 只缓存服务端已批准快照和登记信息。

## 2. 方法合同

| DES ID | 文件 / 方法 | 作用与真实传参 | 真实返回 | 异常或副作用 |
| --- | --- | --- | --- | --- |
| DES-RUL-001 | `规则编写器.py::create_rule(proposal)->RuleDraft` | 规则 Agent 输入一句话原则“设计外文件禁止修改”、范围 `EXECUTION`。 | `RuleDraft(logical_id='EXECUTION_SCOPE_RULE',file_name='RUL_设计范围规则.md')`。 | 多原则或非中文抛 `RuleContentError`；不写正式索引。 |
| DES-RUL-002 | `规则编写器.py::validate_rule(rule)->ValidationReport` | 校验单原则、范围、依赖、替代和业务注释。 | `ValidationReport(passed=True,violations=())`。 | 失败只返回证据，不自动改规则。 |
| DES-RUL-003 | `规则索引器.py::resolve(root_index)->ResolvedRuleSet` | 从唯一根索引解析 30 条以内规则。 | `ResolvedRuleSet(ids=('R1','R2'),digest='sha256:abc')`。 | 重复 ID、循环、失效路径或第 31 条抛 `RuleIndexError`。 |
| DES-RUL-004 | `规则索引器.py::impact(candidate,current)->ImpactReport` | 比较候选与批准版本。 | `ImpactReport(added=('R3',),replaced={'R2':'R4'},affected_stages=('DESIGN',))`。 | 不修改当前批准快照。 |
| DES-RUL-005 | `门禁定义器.py::build(definition)->GateDraft` | Gate Definition Agent 输入 G005 的算法、违规码和证据 Schema。 | `GateDraft(id='G005',file_name='GATE_文件范围检查.md',version='candidate-1')`。 | 缺确定输入/算法/结果合同抛 `GateDefinitionError`。 |
| DES-RUL-006 | `门禁定义器.py::validate_examples(gate,cases)->ValidationReport` | 输入一组 PASS 和 FAIL 样例。 | `ValidationReport(passed=True,case_count=4)`。 | 没有正负样例时候选包不可构建。 |
| DES-RUL-007 | `门禁执行器.py::run(gate,artifact_snapshot)->GateEvidence` | Python 启动 Gate Agent，并由 Agent 驱动 Runner 对只读摘要快照执行 Gate。 | `GateEvidence(gate_id='G005',result='FAIL',violations=('OUT_OF_SCOPE_FILE',),digest='...')`。 | Runner 无写权限；超时/异常返回 FAIL 证据。 |
| DES-RUL-008 | `门禁执行器.py::run_batch(plan,snapshots)->tuple[GateEvidence,...]` | 按 Gate 计划执行本地文件型 Gate。 | 返回按 Gate ID 排序的证据元组。 | 任一受检摘要变化中止批次并返回 `ARTIFACT_CHANGED`。 |
| DES-RUL-009 | `流程提案器.py::build(change,facts)->ProcessDraft` | 输入第三次同指纹失败事实。 | `ProcessDraft(id='PROCESS-PROP-1',failure_domain='D',changes=('add_regate_step',))`。 | 无事实引用时抛 `ProposalEvidenceError`。 |
| DES-RUL-010 | `治理包构建器.py::build(rules,gates,processes)->GovernanceBundle` | 构建不可变 zip/manifest。 | `GovernanceBundle(candidate_id='GOV-C-1',sha256='abc',rule_count=28)`。 | 内容不合法、规则超限或文件摘要漂移时不产包。 |
| DES-RUL-011 | `治理包构建器.py::submit(bundle,evidence)->GovernanceSubmission` | 通过 HTTP 提交候选包或受控摘要。 | `GovernanceSubmission(status='PENDING_APPROVAL',candidate_id='GOV-C-1')`。 | 服务端不能改包；拒绝后须产生新 candidate_id。 |
| DES-RUL-012 | `快照存储器.py::activate(approval,bundle)->ActiveSnapshot` | 校验服务端批准版本和本地包摘要。 | `ActiveSnapshot(version='1.2.0',digest='abc',read_only=True)`。 | 摘要不一致或批准过期抛 `SnapshotApprovalMismatch`。 |
| DES-RUL-013 | `快照存储器.py::load_for_stage(stage,version)->ActiveSnapshot` | 示例阶段 `DESIGN`、版本 `1.2.0`。 | 返回只读快照及适用 Gate 列表。 | 缺快照时禁止正式运行，可进入草稿模式。 |
| DES-RUL-014 | `快照存储器.py::invalidate(version,reason)->None` | 示例 reason `SUPERSEDED_BY_1.3.0`。 | 无返回；标记不可用于新任务。 | 不删除历史包；在途任务继续使用冻结版本。 |

## 3. 候选包 Manifest

```json
{
  "schemaVersion": 1,
  "candidateId": "GOV-C-1",
  "ruleCount": 28,
  "rulesDigest": "sha256:...",
  "gatesDigest": "sha256:...",
  "processDigest": "sha256:...",
  "runnerVersions": {"LOCAL_FILE_SCOPE": "1.0.0"},
  "evidenceDigest": "sha256:..."
}
```

## 4. 安全边界

Rule Factory 可读已授权本地工程材料，但所有输出先进入当前 task_id 任务根；提交服务端前只按策略上传治理包、摘要和证据，源码默认不上传。服务端只登记和批准，不生成、不执行 Gate，也不能替换本地包内容。
