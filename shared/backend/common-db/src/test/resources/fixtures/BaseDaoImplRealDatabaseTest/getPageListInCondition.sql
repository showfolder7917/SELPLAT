-- BaseDaoImplRealDatabaseTest.getPageListInCondition Case 建立真实公共 DAO 集合查询测试表。
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

-- 三个不同租户让 tenantId IN (1,3) 的真实结果可与全表和单值条件区分。
INSERT INTO SharedFixture (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status) VALUES
    (111, 1, 1, 'tenant-one', 'hash', '租户一', 10, 1),
    (112, 2, 1, 'tenant-two', 'hash', '租户二', 20, 1),
    (113, 3, 1, 'tenant-three', 'hash', '租户三', 30, 1);
