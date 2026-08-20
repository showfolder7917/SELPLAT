-- AiStageExecution 保存每个阶段的起止时间、耗时、当前工作和本地审计坐标。
CREATE TABLE IF NOT EXISTS AiStageExecution (
    -- id 是阶段执行记录主键。
    id BIGINT PRIMARY KEY,
    -- projectId 标识阶段所属项目。
    projectId BIGINT NOT NULL,
    -- parentId 指向上级阶段；首级阶段为空。
    parentId BIGINT,
    -- stageCode 是项目内唯一的阶段编码。
    stageCode VARCHAR(100) NOT NULL,
    -- stageName 是阶段在进度页面显示的名称。
    stageName VARCHAR(160) NOT NULL,
    -- status 保存阶段等待、执行中或已完成状态。
    status VARCHAR(20) NOT NULL,
    -- startedAt 保存阶段实际启动时间。
    startedAt TIMESTAMP,
    -- endedAt 保存阶段实际结束时间。
    endedAt TIMESTAMP,
    -- elapsedMillis 保存阶段累计耗时毫秒数。
    elapsedMillis BIGINT NOT NULL DEFAULT 0,
    -- currentWork 摘要显示阶段当前正在处理的工作。
    currentWork VARCHAR(500),
    -- localLogPath 保存本地 Python 审计日志相对路径。
    localLogPath VARCHAR(800),
    -- slowReason 保存阶段耗时异常的分析结论。
    slowReason VARCHAR(1000),
    -- sortnum 保存阶段树和表格的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存阶段记录创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存阶段记录最近更新时间。
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
COMMENT ON COLUMN AiStageExecution.id IS '阶段执行记录主键';
COMMENT ON COLUMN AiStageExecution.projectId IS '阶段所属项目主键';
COMMENT ON COLUMN AiStageExecution.parentId IS '上级阶段记录主键，首级阶段为空';
COMMENT ON COLUMN AiStageExecution.stageCode IS '项目内唯一阶段编码';
COMMENT ON COLUMN AiStageExecution.stageName IS '阶段显示名称';
COMMENT ON COLUMN AiStageExecution.status IS '阶段状态：WAITING等待、RUNNING执行中、COMPLETED已完成';
COMMENT ON COLUMN AiStageExecution.startedAt IS '阶段实际启动时间';
COMMENT ON COLUMN AiStageExecution.endedAt IS '阶段实际结束时间';
COMMENT ON COLUMN AiStageExecution.elapsedMillis IS '阶段累计耗时毫秒数';
COMMENT ON COLUMN AiStageExecution.currentWork IS '阶段当前工作摘要';
COMMENT ON COLUMN AiStageExecution.localLogPath IS '本地Python审计日志相对路径';
COMMENT ON COLUMN AiStageExecution.slowReason IS '阶段耗时异常分析结论';
COMMENT ON COLUMN AiStageExecution.sortnum IS '阶段树和表格的业务排序值';
COMMENT ON COLUMN AiStageExecution.createdAt IS '阶段记录创建时间';
COMMENT ON COLUMN AiStageExecution.updatedAt IS '阶段记录最后更新时间';
