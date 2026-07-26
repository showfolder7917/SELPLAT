-- BaseDaoImplRealDatabaseTest.getByIdCompositeKey Case 建立使用 tenantId 与 itemId 复合主键的真实公共 DAO 测试表。
CREATE TABLE SharedFixture (
    tenantId BIGINT NOT NULL,
    itemId BIGINT NOT NULL,
    loginName VARCHAR(100) NOT NULL,
    displayName VARCHAR(100) NOT NULL,
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (tenantId, itemId)
);

-- 相同 tenantId 下准备两个 itemId，证明查询必须同时使用两个复合主键字段。
INSERT INTO SharedFixture (tenantId, itemId, loginName, displayName, sortnum, status)
VALUES
    (21, 7, 'composite-other', '复合主键非目标记录', 20, 1),
    (21, 8, 'composite-target', '复合主键目标记录', 10, 1);
