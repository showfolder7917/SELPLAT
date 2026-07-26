-- BaseDaoImplRealDatabaseTest.getPageListDefaultSortnum Case 建立真实公共 DAO 测试表。
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

-- id 与 sortnum 顺序不同，用于识别 BaseDaoImpl 默认排序是否真实进入 SQL。
INSERT INTO SharedFixture (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status) VALUES
    (101, 1, 1, 'shared-low', 'hash', '低排序', 10, 1),
    (103, 1, 1, 'shared-high', 'hash', '高排序', 30, 1),
    (102, 1, 1, 'shared-middle', 'hash', '中排序', 20, 1);
