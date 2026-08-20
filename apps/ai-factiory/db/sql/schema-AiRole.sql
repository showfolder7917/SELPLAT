-- AiRole 统一保存角色树、工程师/审核员分类、经验状态及 Codex 连接池策略。
CREATE TABLE IF NOT EXISTS AiRole (
    -- id 是角色树节点主键。
    id BIGINT PRIMARY KEY,
    -- parentId 指向上级角色分类节点；根节点为空。
    parentId BIGINT,
    -- roleCode 是角色对外使用的唯一编码。
    roleCode VARCHAR(80) NOT NULL,
    -- roleName 是角色在管理页面显示的名称。
    roleName VARCHAR(120) NOT NULL,
    -- roleType 区分工程师与审核员。
    roleType VARCHAR(20) NOT NULL,
    -- experienceLevel 标识角色是否复用历史经验。
    experienceLevel VARCHAR(20) NOT NULL,
    -- codexPoolType 决定使用常驻或用完即释放的 Codex 连接池。
    codexPoolType VARCHAR(20) NOT NULL,
    -- specialty 描述角色负责的专业范围。
    specialty VARCHAR(200),
    -- status 保存逻辑状态：0删除、1启用、2停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存角色树和表格的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存角色首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存角色最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_role_parent FOREIGN KEY (parentId) REFERENCES AiRole(id),
    CONSTRAINT uk_ai_role_code UNIQUE (roleCode),
    CONSTRAINT ck_ai_role_type CHECK (roleType IN ('ENGINEER', 'REVIEWER')),
    CONSTRAINT ck_ai_role_experience CHECK (experienceLevel IN ('EXPERIENCED', 'INEXPERIENCED')),
    CONSTRAINT ck_ai_role_pool CHECK (codexPoolType IN ('PERSISTENT', 'DISPOSABLE')),
    CONSTRAINT ck_ai_role_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE AiRole IS 'AI工厂角色树及Codex连接池策略';
COMMENT ON COLUMN AiRole.id IS '角色树节点主键';
COMMENT ON COLUMN AiRole.parentId IS '上级角色分类节点主键，根节点为空';
COMMENT ON COLUMN AiRole.roleCode IS '角色唯一编码';
COMMENT ON COLUMN AiRole.roleName IS '角色显示名称';
COMMENT ON COLUMN AiRole.roleType IS '角色类型：ENGINEER工程师、REVIEWER审核员';
COMMENT ON COLUMN AiRole.experienceLevel IS '经验级别：EXPERIENCED有经验、INEXPERIENCED无经验';
COMMENT ON COLUMN AiRole.codexPoolType IS 'Codex连接池策略：PERSISTENT常驻、DISPOSABLE用完即释放';
COMMENT ON COLUMN AiRole.specialty IS '角色负责的专业范围';
COMMENT ON COLUMN AiRole.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN AiRole.sortnum IS '角色树和表格的业务排序值';
COMMENT ON COLUMN AiRole.createdAt IS '角色创建时间';
COMMENT ON COLUMN AiRole.updatedAt IS '角色最后更新时间';
