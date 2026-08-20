-- AiGate 只登记项目使用的 AI 门禁；代码检查属于测试范围，不建立代码门禁类型。
CREATE TABLE IF NOT EXISTS AiGate (
    -- id 是 AI 门禁主键。
    id BIGINT PRIMARY KEY,
    -- projectId 指向门禁所属项目。
    projectId BIGINT NOT NULL,
    -- gateCode 是门禁对外使用的唯一编码。
    gateCode VARCHAR(80) NOT NULL,
    -- gateName 是门禁在管理页面显示的名称。
    gateName VARCHAR(120) NOT NULL,
    -- gateType 使用引用数据登记的稳定 Key；当前只允许 AI_GATE。
    gateType VARCHAR(30) NOT NULL,
    -- description 说明门禁的检查目标和通过条件。
    description VARCHAR(1000),
    -- status 保存逻辑状态：0删除、1启用、2停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存门禁树和表格的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存门禁首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存门禁最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_gate_project FOREIGN KEY (projectId) REFERENCES AiProject(id),
    CONSTRAINT uk_ai_gate_project_code UNIQUE (projectId, gateCode),
    CONSTRAINT ck_ai_gate_type CHECK (gateType = 'AI_GATE'),
    CONSTRAINT ck_ai_gate_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE AiGate IS 'AI工厂项目AI门禁登记';
COMMENT ON COLUMN AiGate.id IS 'AI门禁主键';
COMMENT ON COLUMN AiGate.projectId IS '所属项目主键';
COMMENT ON COLUMN AiGate.gateCode IS '门禁唯一编码';
COMMENT ON COLUMN AiGate.gateName IS '门禁显示名称';
COMMENT ON COLUMN AiGate.gateType IS '引用数据门禁类型稳定Key，当前固定AI_GATE';
COMMENT ON COLUMN AiGate.description IS '门禁检查目标和通过条件说明';
COMMENT ON COLUMN AiGate.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN AiGate.sortnum IS '门禁树和表格的业务排序值';
COMMENT ON COLUMN AiGate.createdAt IS '门禁创建时间';
COMMENT ON COLUMN AiGate.updatedAt IS '门禁最后更新时间';
