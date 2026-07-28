-- BaseDaoImplRealDatabaseTest.compositeKeyWriteChain Case 建立含公共逻辑删除列的复合主键真实表。
CREATE TABLE SharedFixture (
    tenantId BIGINT NOT NULL,
    itemId BIGINT NOT NULL,
    lastOperateUserId BIGINT NOT NULL,
    loginName VARCHAR(100) NOT NULL,
    displayName VARCHAR(100) NOT NULL,
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenantId, itemId)
);

-- 同一租户准备两个 itemId，验证所有写入链路都必须同时使用两部分主键。
INSERT INTO SharedFixture (tenantId, itemId, lastOperateUserId, loginName, displayName, sortnum, status)
VALUES
    (31, 1, 1, 'composite-one', '复合主键对照', 20, 1),
    (31, 2, 1, 'composite-two', '复合主键目标', 10, 1);
