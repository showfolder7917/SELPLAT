-- AiWorkflowVersion 冻结可运行的流程版本。
CREATE TABLE IF NOT EXISTS AiWorkflowVersion (
 id BIGINT PRIMARY KEY, workflowId BIGINT NOT NULL, versionNo INTEGER NOT NULL,
 status VARCHAR(30) NOT NULL, publishedAt TIMESTAMP, sortnum DECIMAL(18,2) NOT NULL DEFAULT 0,
 createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_ai_workflow_version_definition FOREIGN KEY(workflowId) REFERENCES AiWorkflowDefinition(id),
 CONSTRAINT uk_ai_workflow_version UNIQUE(workflowId,versionNo)
);
COMMENT ON TABLE AiWorkflowVersion IS 'AI工厂流程版本';
COMMENT ON COLUMN AiWorkflowVersion.id IS '流程版本主键';
COMMENT ON COLUMN AiWorkflowVersion.workflowId IS '流程定义主键';
COMMENT ON COLUMN AiWorkflowVersion.versionNo IS '流程版本号';
COMMENT ON COLUMN AiWorkflowVersion.status IS '引用数据流程状态稳定Key';
COMMENT ON COLUMN AiWorkflowVersion.publishedAt IS '发布时间';
COMMENT ON COLUMN AiWorkflowVersion.sortnum IS '业务排序值';
COMMENT ON COLUMN AiWorkflowVersion.createdAt IS '创建时间';
COMMENT ON COLUMN AiWorkflowVersion.updatedAt IS '最后更新时间';
