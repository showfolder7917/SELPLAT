-- AiStageExecution 保存每个阶段的起止时间、耗时、当前工作和本地审计坐标。
CREATE TABLE IF NOT EXISTS AiStageExecution (
    id BIGINT PRIMARY KEY,
    projectId BIGINT NOT NULL,
    parentId BIGINT,
    stageCode VARCHAR(100) NOT NULL,
    stageName VARCHAR(160) NOT NULL,
    status VARCHAR(20) NOT NULL,
    startedAt TIMESTAMP,
    endedAt TIMESTAMP,
    elapsedMillis BIGINT NOT NULL DEFAULT 0,
    currentWork VARCHAR(500),
    localLogPath VARCHAR(800),
    slowReason VARCHAR(1000),
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_stage_execution_project FOREIGN KEY (projectId) REFERENCES AiProject(id),
    CONSTRAINT fk_ai_stage_execution_parent FOREIGN KEY (parentId) REFERENCES AiStageExecution(id),
    CONSTRAINT uk_ai_stage_execution_code UNIQUE (projectId, stageCode),
    CONSTRAINT ck_ai_stage_execution_status CHECK (status IN ('WAITING', 'RUNNING', 'COMPLETED')),
    CONSTRAINT ck_ai_stage_execution_time CHECK (endedAt IS NULL OR startedAt IS NULL OR endedAt >= startedAt)
);

CREATE INDEX IF NOT EXISTS idx_ai_stage_execution_project_status
    ON AiStageExecution(projectId, status, sortnum);

COMMENT ON TABLE AiStageExecution IS 'AI工厂阶段执行时间与本地日志审计';
