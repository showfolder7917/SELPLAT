-- AiRule 登记项目使用的本地规则文件，不再建立规则目录树。
CREATE TABLE IF NOT EXISTS AiRule (
    -- id 是规则登记主键。
    id BIGINT PRIMARY KEY,
    -- projectId 指向规则所属项目。
    projectId BIGINT NOT NULL,
    -- ruleCode 是规则对外使用的唯一编码。
    ruleCode VARCHAR(100) NOT NULL,
    -- ruleName 是规则在管理页面显示的名称。
    ruleName VARCHAR(200) NOT NULL,
    -- ruleType 使用引用数据登记的规则类型稳定 Key。
    ruleType VARCHAR(30) NOT NULL,
    -- logicalPath 保存本地 memory 中规则的逻辑路径。
    logicalPath VARCHAR(500) NOT NULL,
    -- description 说明规则用途和适用范围。
    description VARCHAR(1000),
    -- status 保存逻辑状态：0删除、1启用、2停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存规则树和表格的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存规则首次登记时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存规则最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_rule_project FOREIGN KEY (projectId) REFERENCES AiProject(id),
    CONSTRAINT uk_ai_rule_project_code UNIQUE (projectId, ruleCode),
    CONSTRAINT ck_ai_rule_type CHECK (ruleType IN ('RULE', 'AI_GATE')),
    CONSTRAINT ck_ai_rule_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE AiRule IS 'AI工厂项目本地规则登记';
COMMENT ON COLUMN AiRule.id IS '规则登记主键';
COMMENT ON COLUMN AiRule.projectId IS '所属项目主键';
COMMENT ON COLUMN AiRule.ruleCode IS '规则唯一编码';
COMMENT ON COLUMN AiRule.ruleName IS '规则显示名称';
COMMENT ON COLUMN AiRule.ruleType IS '引用数据规则类型稳定Key';
COMMENT ON COLUMN AiRule.logicalPath IS '本地memory中规则文件的逻辑路径';
COMMENT ON COLUMN AiRule.description IS '规则用途和适用范围说明';
COMMENT ON COLUMN AiRule.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN AiRule.sortnum IS '规则树和表格的业务排序值';
COMMENT ON COLUMN AiRule.createdAt IS '规则登记时间';
COMMENT ON COLUMN AiRule.updatedAt IS '规则最后更新时间';
