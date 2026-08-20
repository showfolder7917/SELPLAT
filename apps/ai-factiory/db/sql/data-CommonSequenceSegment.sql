-- 每张业务表独立登记号段；种子表游标避开已有六位固定数据，运行表从统一 100000 起步。
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiRoleId','AI工厂角色主键',101000,100,0,'AiRole独立主键号段，100000至100999保留给固定角色种子',10,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiRoleId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiGateId','AI工厂门禁主键',111000,100,0,'AiGate独立主键号段，游标高于既有门禁种子',20,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiGateId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiRuleId','AI工厂规则主键',121000,100,0,'AiRule独立主键号段，游标高于既有规则种子',30,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiRuleId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiProjectId','AI工厂项目主键',131000,100,0,'AiProject独立主键号段，游标高于既有项目种子',40,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiProjectId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiWorkflowDefinitionId','流程定义主键',151000,100,0,'AiWorkflowDefinition独立主键号段',51,1 WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiWorkflowDefinitionId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiWorkflowVersionId','流程版本主键',161000,100,0,'AiWorkflowVersion独立主键号段',52,1 WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiWorkflowVersionId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiWorkflowNodeId','流程节点主键',171000,100,0,'AiWorkflowNode独立主键号段',53,1 WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiWorkflowNodeId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiWorkflowEdgeId','流程连线主键',181000,100,0,'AiWorkflowEdge独立主键号段',54,1 WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiWorkflowEdgeId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiWorkflowRunId','流程运行主键',191000,100,0,'AiWorkflowRun独立主键号段',55,1 WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiWorkflowRunId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiWorkflowNodeRunId','流程节点运行主键',201000,100,0,'AiWorkflowNodeRun独立主键号段',56,1 WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiWorkflowNodeRunId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiAgentRegistrationId','Agent登记主键',101000,100,0,'ai_agent_registration独立主键号段，100000保留给默认Agent',60,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiAgentRegistrationId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiRoleVersionId','角色版本主键',101000,100,0,'ai_role_version独立主键号段，100000保留给默认角色版本',70,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiRoleVersionId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiRoleAgentBindingId','角色Agent绑定主键',101000,100,0,'ai_role_agent_binding独立主键号段，100000保留给默认绑定',80,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiRoleAgentBindingId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiTaskId','任务主键',100000,100,0,'ai_task独立主键号段',90,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiTaskId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiTaskStageId','任务阶段主键',100000,100,0,'ai_task_stage独立主键号段',100,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiTaskStageId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiStageRunId','阶段运行主键',100000,100,0,'ai_stage_run独立主键号段',110,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiStageRunId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiProgressEventSequence','进度事件游标',100000,100,0,'ai_progress_event递增游标号段',120,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiProgressEventSequence');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiAgentStateEventId','Agent状态事件主键',100000,100,0,'ai_agent_state_event独立主键号段',130,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiAgentStateEventId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiArtifactId','任务产物主键',100000,100,0,'ai_artifact独立主键号段',140,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiArtifactId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiGateResultId','门禁结果主键',100000,100,0,'ai_gate_result独立主键号段',150,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiGateResultId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiAuditEventId','服务端审计事件主键',100000,100,0,'ai_audit_event独立主键号段',160,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiAuditEventId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiClientDeviceId','客户端设备主键',100000,100,0,'ai_client_device独立主键号段',170,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiClientDeviceId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiRequirementItemId','需求要件主键',100000,100,0,'ai_requirement_item独立主键号段',180,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiRequirementItemId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiTraceLinkId','追踪关系主键',100000,100,0,'ai_trace_link独立主键号段',190,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiTraceLinkId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiGovernancePackageId','治理包主键',100000,100,0,'ai_governance_package独立主键号段',200,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiGovernancePackageId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiGateDefinitionVersionId','门禁定义版本主键',100000,100,0,'ai_gate_definition_version独立主键号段',210,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiGateDefinitionVersionId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiApprovalId','审批记录主键',100000,100,0,'ai_approval独立主键号段',220,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiApprovalId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiErrorLogId','错误日志主键',100000,100,0,'ai_error_log独立主键号段',230,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiErrorLogId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiRetrospectiveId','任务复盘主键',100000,100,0,'ai_retrospective独立主键号段',240,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiRetrospectiveId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiImprovementProposalId','改进提案主键',100000,100,0,'ai_improvement_proposal独立主键号段',250,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiImprovementProposalId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiIdempotencyRecordId','幂等请求主键',100000,100,0,'ai_idempotency_record独立主键号段',260,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiIdempotencyRecordId');
INSERT INTO CommonSequenceSegment (seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 'AiTaskAgentBindingId','任务Agent绑定主键',100000,100,0,'ai_task_agent_binding独立主键号段',270,1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='AiTaskAgentBindingId');
