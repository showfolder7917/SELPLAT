-- AiGate 统一保存项目门、AI 门禁和代码门禁树。
CREATE TABLE IF NOT EXISTS AiGate (
    id BIGINT PRIMARY KEY,
    parentId BIGINT,
    gateCode VARCHAR(80) NOT NULL,
    gateName VARCHAR(120) NOT NULL,
    gateType VARCHAR(30) NOT NULL,
    projectCode VARCHAR(80),
    description VARCHAR(1000),
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_gate_parent FOREIGN KEY (parentId) REFERENCES AiGate(id),
    CONSTRAINT uk_ai_gate_code UNIQUE (gateCode),
    CONSTRAINT ck_ai_gate_type CHECK (gateType IN ('ROOT', 'PROJECT', 'AI', 'CODE')),
    CONSTRAINT ck_ai_gate_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE AiGate IS 'AI工厂门禁管理树';
