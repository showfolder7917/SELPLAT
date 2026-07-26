-- BaseDaoImplRealDatabaseTest.getByQueryFound Case 建立真实公共 DAO 测试表。
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

-- 两个租户使用不同账号，验证 CommonParam 的全部条件真实进入 where。
INSERT INTO SharedFixture (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status) VALUES
    (301, 3, 1, 'query-target', 'hash', '动态查询目标', 10, 1),
    (302, 4, 1, 'query-target', 'hash', '其他租户记录', 20, 1);
