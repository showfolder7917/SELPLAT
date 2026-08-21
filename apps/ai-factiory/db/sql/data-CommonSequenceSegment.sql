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
