-- AiProject 保存项目树、当前阶段和当前工作摘要。
CREATE TABLE IF NOT EXISTS AiProject (
    id BIGINT PRIMARY KEY,
    parentId BIGINT,
    projectCode VARCHAR(80) NOT NULL,
    projectName VARCHAR(160) NOT NULL,
    currentStage VARCHAR(80),
    currentWork VARCHAR(500),
    progressPercent INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_project_parent FOREIGN KEY (parentId) REFERENCES AiProject(id),
    CONSTRAINT uk_ai_project_code UNIQUE (projectCode),
    CONSTRAINT ck_ai_project_status CHECK (status IN ('WAITING', 'RUNNING', 'COMPLETED')),
    CONSTRAINT ck_ai_project_progress CHECK (progressPercent BETWEEN 0 AND 100)
);

COMMENT ON TABLE AiProject IS 'AI工厂项目树及当前进度';
