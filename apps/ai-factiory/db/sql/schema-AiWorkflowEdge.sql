-- AiWorkflowEdge 保存节点间有向连线，拓扑决定串行或并行。
CREATE TABLE IF NOT EXISTS AiWorkflowEdge (
 id BIGINT PRIMARY KEY, workflowVersionId BIGINT NOT NULL, sourceNodeId BIGINT NOT NULL,
 targetNodeId BIGINT NOT NULL, edgeType VARCHAR(30) NOT NULL, conditionExpression VARCHAR(1000),
 status INTEGER NOT NULL DEFAULT 1, sortnum DECIMAL(18,2) NOT NULL DEFAULT 0,
 createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_ai_workflow_edge_version FOREIGN KEY(workflowVersionId) REFERENCES AiWorkflowVersion(id),
 CONSTRAINT fk_ai_workflow_edge_source FOREIGN KEY(sourceNodeId) REFERENCES AiWorkflowNode(id),
 CONSTRAINT fk_ai_workflow_edge_target FOREIGN KEY(targetNodeId) REFERENCES AiWorkflowNode(id),
 CONSTRAINT uk_ai_workflow_edge UNIQUE(workflowVersionId,sourceNodeId,targetNodeId,edgeType),
 CONSTRAINT ck_ai_workflow_edge_not_self CHECK(sourceNodeId<>targetNodeId),
 CONSTRAINT ck_ai_workflow_edge_status CHECK(status IN (0,1,2))
);
COMMENT ON TABLE AiWorkflowEdge IS 'AI工厂流程节点有向连线';
COMMENT ON COLUMN AiWorkflowEdge.id IS '流程连线主键';
COMMENT ON COLUMN AiWorkflowEdge.workflowVersionId IS '所属流程版本主键';
COMMENT ON COLUMN AiWorkflowEdge.sourceNodeId IS '起点节点实例主键';
COMMENT ON COLUMN AiWorkflowEdge.targetNodeId IS '终点节点实例主键';
COMMENT ON COLUMN AiWorkflowEdge.edgeType IS '引用数据连线类型稳定Key';
COMMENT ON COLUMN AiWorkflowEdge.conditionExpression IS '条件连线表达式';
COMMENT ON COLUMN AiWorkflowEdge.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN AiWorkflowEdge.sortnum IS '业务排序值';
COMMENT ON COLUMN AiWorkflowEdge.createdAt IS '创建时间';
COMMENT ON COLUMN AiWorkflowEdge.updatedAt IS '最后更新时间';
