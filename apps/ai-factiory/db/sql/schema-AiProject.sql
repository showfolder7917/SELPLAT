-- AiProject 只保存可维护的项目登记；阶段与进度由流程运行表计算。
CREATE TABLE IF NOT EXISTS AiProject (
    -- id 是项目主键。
    id BIGINT PRIMARY KEY,
    -- projectCode 是项目对外使用的唯一编码。
    projectCode VARCHAR(80) NOT NULL,
    -- projectName 是项目在管理页面显示的名称。
    projectName VARCHAR(160) NOT NULL,
    -- description 说明项目目标和范围。
    description VARCHAR(1000),
    -- status 保存逻辑状态：0删除、1启用、2停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存项目树和表格的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存项目首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存项目最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_ai_project_code UNIQUE (projectCode),
    CONSTRAINT ck_ai_project_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE AiProject IS 'AI工厂项目登记';
COMMENT ON COLUMN AiProject.id IS '项目主键';
COMMENT ON COLUMN AiProject.projectCode IS '项目唯一编码';
COMMENT ON COLUMN AiProject.projectName IS '项目显示名称';
COMMENT ON COLUMN AiProject.description IS '项目目标和范围说明';
COMMENT ON COLUMN AiProject.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN AiProject.sortnum IS '项目树和表格的业务排序值';
COMMENT ON COLUMN AiProject.createdAt IS '项目创建时间';
COMMENT ON COLUMN AiProject.updatedAt IS '项目最后更新时间';
