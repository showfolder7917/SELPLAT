-- AiWorkflowRun 保存 Python 驱动上报的一次流程运行事实。
CREATE TABLE IF NOT EXISTS AiWorkflowRun (
 id BIGINT PRIMARY KEY, workflowVersionId BIGINT NOT NULL, taskId BIGINT,
 status VARCHAR(30) NOT NULL, currentWork VARCHAR(500), startedAt TIMESTAMP, endedAt TIMESTAMP,
 createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_ai_workflow_run_version FOREIGN KEY(workflowVersionId) REFERENCES AiWorkflowVersion(id)
);
COMMENT ON TABLE AiWorkflowRun IS 'AI工厂流程运行事实';
COMMENT ON COLUMN AiWorkflowRun.id IS '流程运行主键';
COMMENT ON COLUMN AiWorkflowRun.workflowVersionId IS '运行使用的冻结流程版本';
COMMENT ON COLUMN AiWorkflowRun.taskId IS 'Python工作流请求携带的外部任务标识，不依赖本地旧任务表';
COMMENT ON COLUMN AiWorkflowRun.status IS '引用数据运行状态稳定Key';
COMMENT ON COLUMN AiWorkflowRun.currentWork IS '当前工作摘要';
COMMENT ON COLUMN AiWorkflowRun.startedAt IS '启动时间';
COMMENT ON COLUMN AiWorkflowRun.endedAt IS '结束时间';
COMMENT ON COLUMN AiWorkflowRun.createdAt IS '创建时间';
COMMENT ON COLUMN AiWorkflowRun.updatedAt IS '最后更新时间';
