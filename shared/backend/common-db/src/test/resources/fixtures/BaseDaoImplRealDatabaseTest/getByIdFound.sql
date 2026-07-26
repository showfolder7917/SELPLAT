-- BaseDaoImplRealDatabaseTest.getByIdFound Case 建立真实公共 DAO 测试表。
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

-- status 为零证明公共主键查询不会偷偷追加业务有效状态条件。
INSERT INTO SharedFixture (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status)
VALUES (201, 2, 9, 'shared-detail', 'hash', '公共详情', 10, 0);
