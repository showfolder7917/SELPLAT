-- AiRole 统一保存角色树、工程师/审核员分类、经验状态及 Codex 连接池策略。
CREATE TABLE IF NOT EXISTS AiRole (
    id BIGINT PRIMARY KEY,
    parentId BIGINT,
    roleCode VARCHAR(80) NOT NULL,
    roleName VARCHAR(120) NOT NULL,
    roleType VARCHAR(20) NOT NULL,
    experienceLevel VARCHAR(20) NOT NULL,
    codexPoolType VARCHAR(20) NOT NULL,
    specialty VARCHAR(200),
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_role_parent FOREIGN KEY (parentId) REFERENCES AiRole(id),
    CONSTRAINT uk_ai_role_code UNIQUE (roleCode),
    CONSTRAINT ck_ai_role_type CHECK (roleType IN ('ENGINEER', 'REVIEWER')),
    CONSTRAINT ck_ai_role_experience CHECK (experienceLevel IN ('EXPERIENCED', 'INEXPERIENCED')),
    CONSTRAINT ck_ai_role_pool CHECK (codexPoolType IN ('PERSISTENT', 'DISPOSABLE')),
    CONSTRAINT ck_ai_role_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE AiRole IS 'AI工厂角色树及Codex连接池策略';
