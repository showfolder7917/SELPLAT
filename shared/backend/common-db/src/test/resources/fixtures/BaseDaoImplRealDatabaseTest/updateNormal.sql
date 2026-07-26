-- BaseDaoImplRealDatabaseTest.updateNormal Case 建立真实公共 DAO 测试表。
CREATE TABLE SharedFixture (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL,
    lastOperateUserId BIGINT NOT NULL,
    loginName VARCHAR(100) NOT NULL,
    passwordHash VARCHAR(255) NOT NULL,
    displayName VARCHAR(100) NOT NULL,
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 当前目标记录用于验证主键只进入 where，其余字段进入 set。
INSERT INTO SharedFixture (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status)
VALUES (501, 5, 1, 'shared-update', 'original-hash', '更新前名称', 10, 1);
