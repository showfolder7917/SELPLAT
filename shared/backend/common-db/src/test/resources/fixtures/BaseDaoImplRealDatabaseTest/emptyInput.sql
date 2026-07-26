-- BaseDaoImplRealDatabaseTest.emptyInput Case 建立真实公共 DAO 测试表，供空参数边界验证确认查询在 SQL 前终止。
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

-- 准备一条真实记录，证明空主键或空动态条件不会意外退化成全表首条查询。
INSERT INTO SharedFixture (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status)
VALUES (801, 8, 1, 'empty-input-guard', 'hash', '空参数保护记录', 10, 1);
