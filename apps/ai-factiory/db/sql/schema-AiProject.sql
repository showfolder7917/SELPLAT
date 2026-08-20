-- AiProject 保存项目树、当前阶段和当前工作摘要。
CREATE TABLE IF NOT EXISTS AiProject (
    -- id 是项目树节点主键。
    id BIGINT PRIMARY KEY,
    -- parentId 指向上级项目目录；根节点为空。
    parentId BIGINT,
    -- projectCode 是项目对外使用的唯一编码。
    projectCode VARCHAR(80) NOT NULL,
    -- projectName 是项目在管理页面显示的名称。
    projectName VARCHAR(160) NOT NULL,
    -- currentStage 标识项目当前执行阶段。
    currentStage VARCHAR(80),
    -- currentWork 摘要显示项目正在处理的工作。
    currentWork VARCHAR(500),
    -- progressPercent 保存项目总体完成百分比。
    progressPercent INTEGER NOT NULL DEFAULT 0,
    -- status 保存项目等待、执行中或已完成状态。
    status VARCHAR(20) NOT NULL,
    -- sortnum 保存项目树和表格的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存项目首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存项目最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_project_parent FOREIGN KEY (parentId) REFERENCES AiProject(id),
    CONSTRAINT uk_ai_project_code UNIQUE (projectCode),
    CONSTRAINT ck_ai_project_status CHECK (status IN ('WAITING', 'RUNNING', 'COMPLETED')),
    CONSTRAINT ck_ai_project_progress CHECK (progressPercent BETWEEN 0 AND 100)
);

COMMENT ON TABLE AiProject IS 'AI工厂项目树及当前进度';
COMMENT ON COLUMN AiProject.id IS '项目树节点主键';
COMMENT ON COLUMN AiProject.parentId IS '上级项目目录节点主键，根节点为空';
COMMENT ON COLUMN AiProject.projectCode IS '项目唯一编码';
COMMENT ON COLUMN AiProject.projectName IS '项目显示名称';
COMMENT ON COLUMN AiProject.currentStage IS '项目当前执行阶段编码';
COMMENT ON COLUMN AiProject.currentWork IS '项目当前工作摘要';
COMMENT ON COLUMN AiProject.progressPercent IS '项目总体完成百分比，范围0至100';
COMMENT ON COLUMN AiProject.status IS '项目状态：WAITING等待、RUNNING执行中、COMPLETED已完成';
COMMENT ON COLUMN AiProject.sortnum IS '项目树和表格的业务排序值';
COMMENT ON COLUMN AiProject.createdAt IS '项目创建时间';
COMMENT ON COLUMN AiProject.updatedAt IS '项目最后更新时间';
