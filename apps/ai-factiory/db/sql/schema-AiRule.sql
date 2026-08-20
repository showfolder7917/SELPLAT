-- AiRule 统一保存通用规则和项目规则树的登记信息。
CREATE TABLE IF NOT EXISTS AiRule (
    -- id 是规则树节点主键。
    id BIGINT PRIMARY KEY,
    -- parentId 指向上级规则目录；根节点为空。
    parentId BIGINT,
    -- ruleCode 是规则对外使用的唯一编码。
    ruleCode VARCHAR(100) NOT NULL,
    -- ruleName 是规则在管理页面显示的名称。
    ruleName VARCHAR(200) NOT NULL,
    -- ruleScope 区分根目录、通用规则和项目规则。
    ruleScope VARCHAR(20) NOT NULL,
    -- projectCode 标识项目规则所属项目。
    projectCode VARCHAR(80),
    -- logicalPath 保存本地 memory 中规则的逻辑路径。
    logicalPath VARCHAR(500),
    -- status 保存逻辑状态：0删除、1启用、2停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存规则树和表格的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存规则首次登记时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存规则最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_rule_parent FOREIGN KEY (parentId) REFERENCES AiRule(id),
    CONSTRAINT uk_ai_rule_code UNIQUE (ruleCode),
    CONSTRAINT ck_ai_rule_scope CHECK (ruleScope IN ('ROOT', 'COMMON', 'PROJECT')),
    CONSTRAINT ck_ai_rule_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE AiRule IS 'AI工厂规则管理树';
COMMENT ON COLUMN AiRule.id IS '规则树节点主键';
COMMENT ON COLUMN AiRule.parentId IS '上级规则目录节点主键，根节点为空';
COMMENT ON COLUMN AiRule.ruleCode IS '规则唯一编码';
COMMENT ON COLUMN AiRule.ruleName IS '规则显示名称';
COMMENT ON COLUMN AiRule.ruleScope IS '规则范围：ROOT根、COMMON通用、PROJECT项目';
COMMENT ON COLUMN AiRule.projectCode IS '项目规则所属项目编码';
COMMENT ON COLUMN AiRule.logicalPath IS '本地memory中规则文件的逻辑路径';
COMMENT ON COLUMN AiRule.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN AiRule.sortnum IS '规则树和表格的业务排序值';
COMMENT ON COLUMN AiRule.createdAt IS '规则登记时间';
COMMENT ON COLUMN AiRule.updatedAt IS '规则最后更新时间';
