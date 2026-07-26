-- BaseDaoImplRealDatabaseTest.getIdSequenceDefinitionSingleId Case 建立带单主键的真实表结构，让号段定义来自 JDBC 元数据。
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
