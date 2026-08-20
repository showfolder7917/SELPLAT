-- AiWorkflowNodeRun 保存每个角色节点实例的独立执行事实与本地审计坐标。
CREATE TABLE IF NOT EXISTS AiWorkflowNodeRun (
 id BIGINT PRIMARY KEY, workflowRunId BIGINT NOT NULL, nodeId BIGINT NOT NULL, roleId BIGINT,
 agentRegistrationId BIGINT, status VARCHAR(30) NOT NULL, currentWork VARCHAR(500),
 startedAt TIMESTAMP, endedAt TIMESTAMP, elapsedMillis BIGINT NOT NULL DEFAULT 0,
 localLogPath VARCHAR(1000), sortnum DECIMAL(18,2) NOT NULL DEFAULT 0,
 createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_ai_workflow_node_run_workflow FOREIGN KEY(workflowRunId) REFERENCES AiWorkflowRun(id),
 CONSTRAINT fk_ai_workflow_node_run_node FOREIGN KEY(nodeId) REFERENCES AiWorkflowNode(id),
 CONSTRAINT fk_ai_workflow_node_run_role FOREIGN KEY(roleId) REFERENCES AiRole(id),
 CONSTRAINT fk_ai_workflow_node_run_agent FOREIGN KEY(agentRegistrationId) REFERENCES ai_agent_registration(id),
 CONSTRAINT uk_ai_workflow_node_run UNIQUE(workflowRunId,nodeId)
);
COMMENT ON TABLE AiWorkflowNodeRun IS 'AI工厂流程角色节点执行事实';
COMMENT ON COLUMN AiWorkflowNodeRun.id IS '节点运行主键';
COMMENT ON COLUMN AiWorkflowNodeRun.workflowRunId IS '所属流程运行主键';
COMMENT ON COLUMN AiWorkflowNodeRun.nodeId IS '对应画布节点实例主键';
COMMENT ON COLUMN AiWorkflowNodeRun.roleId IS '节点使用的角色主键';
COMMENT ON COLUMN AiWorkflowNodeRun.agentRegistrationId IS 'Python启动的Agent登记主键';
COMMENT ON COLUMN AiWorkflowNodeRun.status IS '引用数据节点运行状态稳定Key';
COMMENT ON COLUMN AiWorkflowNodeRun.currentWork IS '节点当前工作摘要';
COMMENT ON COLUMN AiWorkflowNodeRun.startedAt IS '节点启动时间';
COMMENT ON COLUMN AiWorkflowNodeRun.endedAt IS '节点结束时间';
COMMENT ON COLUMN AiWorkflowNodeRun.elapsedMillis IS '节点累计耗时毫秒数';
COMMENT ON COLUMN AiWorkflowNodeRun.localLogPath IS '本地Python审计日志相对路径';
COMMENT ON COLUMN AiWorkflowNodeRun.sortnum IS '业务排序值';
COMMENT ON COLUMN AiWorkflowNodeRun.createdAt IS '创建时间';
COMMENT ON COLUMN AiWorkflowNodeRun.updatedAt IS '最后更新时间';
