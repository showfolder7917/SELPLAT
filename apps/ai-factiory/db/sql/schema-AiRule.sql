-- AiRule 统一保存通用规则和项目规则树的登记信息。
CREATE TABLE IF NOT EXISTS AiRule (
    id BIGINT PRIMARY KEY,
    parentId BIGINT,
    ruleCode VARCHAR(100) NOT NULL,
    ruleName VARCHAR(200) NOT NULL,
    ruleScope VARCHAR(20) NOT NULL,
    projectCode VARCHAR(80),
    logicalPath VARCHAR(500),
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_rule_parent FOREIGN KEY (parentId) REFERENCES AiRule(id),
    CONSTRAINT uk_ai_rule_code UNIQUE (ruleCode),
    CONSTRAINT ck_ai_rule_scope CHECK (ruleScope IN ('ROOT', 'COMMON', 'PROJECT')),
    CONSTRAINT ck_ai_rule_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE AiRule IS 'AI工厂规则管理树';
