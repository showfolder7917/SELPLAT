-- AiWorkflowNode 保存画布中的独立节点实例，同一角色可重复出现。
CREATE TABLE IF NOT EXISTS AiWorkflowNode (
 id BIGINT PRIMARY KEY, workflowVersionId BIGINT NOT NULL, nodeCode VARCHAR(120) NOT NULL,
 nodeName VARCHAR(160) NOT NULL, nodeType VARCHAR(30) NOT NULL, roleId BIGINT, gateId BIGINT,
 positionX DECIMAL(18,2) NOT NULL DEFAULT 0, positionY DECIMAL(18,2) NOT NULL DEFAULT 0,
 joinPolicy VARCHAR(30) NOT NULL DEFAULT 'ALL', configJson CLOB, status INTEGER NOT NULL DEFAULT 1,
 sortnum DECIMAL(18,2) NOT NULL DEFAULT 0, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_ai_workflow_node_version FOREIGN KEY(workflowVersionId) REFERENCES AiWorkflowVersion(id),
 CONSTRAINT fk_ai_workflow_node_role FOREIGN KEY(roleId) REFERENCES AiRole(id),
 CONSTRAINT fk_ai_workflow_node_gate FOREIGN KEY(gateId) REFERENCES AiGate(id),
 CONSTRAINT uk_ai_workflow_node_code UNIQUE(workflowVersionId,nodeCode),
 CONSTRAINT ck_ai_workflow_node_status CHECK(status IN (0,1,2))
);
COMMENT ON TABLE AiWorkflowNode IS 'AI工厂流程画布节点实例';
COMMENT ON COLUMN AiWorkflowNode.id IS '流程节点实例主键';
COMMENT ON COLUMN AiWorkflowNode.workflowVersionId IS '所属流程版本主键';
COMMENT ON COLUMN AiWorkflowNode.nodeCode IS '版本内节点唯一编码';
COMMENT ON COLUMN AiWorkflowNode.nodeName IS '节点显示名称';
COMMENT ON COLUMN AiWorkflowNode.nodeType IS '引用数据节点类型稳定Key';
COMMENT ON COLUMN AiWorkflowNode.roleId IS '角色节点绑定的角色主键';
COMMENT ON COLUMN AiWorkflowNode.gateId IS '门禁节点绑定的门禁主键';
COMMENT ON COLUMN AiWorkflowNode.positionX IS '画布横坐标';
COMMENT ON COLUMN AiWorkflowNode.positionY IS '画布纵坐标';
COMMENT ON COLUMN AiWorkflowNode.joinPolicy IS '引用数据汇聚策略稳定Key';
COMMENT ON COLUMN AiWorkflowNode.configJson IS '节点扩展配置JSON';
COMMENT ON COLUMN AiWorkflowNode.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN AiWorkflowNode.sortnum IS '业务排序值';
COMMENT ON COLUMN AiWorkflowNode.createdAt IS '创建时间';
COMMENT ON COLUMN AiWorkflowNode.updatedAt IS '最后更新时间';
