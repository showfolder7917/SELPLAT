-- AiGate 统一保存项目门、AI 门禁和代码门禁树。
CREATE TABLE IF NOT EXISTS AiGate (
    -- id 是门禁树节点主键。
    id BIGINT PRIMARY KEY,
    -- parentId 指向上级门禁节点；根节点为空。
    parentId BIGINT,
    -- gateCode 是门禁对外使用的唯一编码。
    gateCode VARCHAR(80) NOT NULL,
    -- gateName 是门禁在管理页面显示的名称。
    gateName VARCHAR(120) NOT NULL,
    -- gateType 区分根、项目、AI 与代码门禁。
    gateType VARCHAR(30) NOT NULL,
    -- projectCode 标识项目专属门禁所属项目。
    projectCode VARCHAR(80),
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
    CONSTRAINT fk_ai_gate_parent FOREIGN KEY (parentId) REFERENCES AiGate(id),
    CONSTRAINT uk_ai_gate_code UNIQUE (gateCode),
    CONSTRAINT ck_ai_gate_type CHECK (gateType IN ('ROOT', 'PROJECT', 'AI', 'CODE')),
    CONSTRAINT ck_ai_gate_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE AiGate IS 'AI工厂门禁管理树';
COMMENT ON COLUMN AiGate.id IS '门禁树节点主键';
COMMENT ON COLUMN AiGate.parentId IS '上级门禁节点主键，根节点为空';
COMMENT ON COLUMN AiGate.gateCode IS '门禁唯一编码';
COMMENT ON COLUMN AiGate.gateName IS '门禁显示名称';
COMMENT ON COLUMN AiGate.gateType IS '门禁类型：ROOT根、PROJECT项目、AI智能体、CODE代码';
COMMENT ON COLUMN AiGate.projectCode IS '项目专属门禁所属项目编码';
COMMENT ON COLUMN AiGate.description IS '门禁检查目标和通过条件说明';
COMMENT ON COLUMN AiGate.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN AiGate.sortnum IS '门禁树和表格的业务排序值';
COMMENT ON COLUMN AiGate.createdAt IS '门禁创建时间';
COMMENT ON COLUMN AiGate.updatedAt IS '门禁最后更新时间';
