-- BaseDaoImplRealDatabaseTest.queryNotFound Case 建立真实公共 DAO 测试表，供未命中动态条件验证使用。
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

-- 插入与待查账号不同的真实记录，证明 queryNotFound 返回空是条件未命中而不是空表偶然结果。
INSERT INTO SharedFixture (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status)
VALUES (901, 9, 1, 'existing-user', 'hash', '未命中对照记录', 10, 1);
