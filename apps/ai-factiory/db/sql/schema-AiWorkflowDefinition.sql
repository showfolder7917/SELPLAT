-- AiWorkflowDefinition 保存项目流程定义。
CREATE TABLE IF NOT EXISTS AiWorkflowDefinition (
 id BIGINT PRIMARY KEY, projectId BIGINT NOT NULL, workflowCode VARCHAR(100) NOT NULL,
 workflowName VARCHAR(160) NOT NULL, description VARCHAR(1000), status INTEGER NOT NULL DEFAULT 1,
 sortnum DECIMAL(18,2) NOT NULL DEFAULT 0, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_ai_workflow_definition_project FOREIGN KEY(projectId) REFERENCES AiProject(id),
 CONSTRAINT uk_ai_workflow_definition_code UNIQUE(workflowCode),
 CONSTRAINT ck_ai_workflow_definition_status CHECK(status IN (0,1,2))
);
COMMENT ON TABLE AiWorkflowDefinition IS 'AI工厂项目流程定义';
COMMENT ON COLUMN AiWorkflowDefinition.id IS '流程定义主键';
COMMENT ON COLUMN AiWorkflowDefinition.projectId IS '所属项目主键';
COMMENT ON COLUMN AiWorkflowDefinition.workflowCode IS '流程稳定编码';
COMMENT ON COLUMN AiWorkflowDefinition.workflowName IS '流程显示名称';
COMMENT ON COLUMN AiWorkflowDefinition.description IS '流程用途说明';
COMMENT ON COLUMN AiWorkflowDefinition.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN AiWorkflowDefinition.sortnum IS '业务排序值';
COMMENT ON COLUMN AiWorkflowDefinition.createdAt IS '创建时间';
COMMENT ON COLUMN AiWorkflowDefinition.updatedAt IS '最后更新时间';
