-- SequenceGeneratorRealDatabaseTest.getSequenceComposite Case 建立公共号段真实表，字段与生产 DAO SQL 完全一致。
CREATE TABLE CommonSequenceSegment (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL,
    lastOperateUserId BIGINT NOT NULL,
    seqCode VARCHAR(64) NOT NULL UNIQUE,
    seqName VARCHAR(128) NOT NULL,
    nextStartId BIGINT NOT NULL,
    stepSize INT NOT NULL,
    versionNo INT NOT NULL DEFAULT 0,
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 两个复合主键字段分别拥有独立数据库号段，验证字段和值不会被合并或错位。
INSERT INTO CommonSequenceSegment (
    id,
    tenantId,
    lastOperateUserId,
    seqCode,
    seqName,
    nextStartId,
    stepSize,
    versionNo,
    sortnum,
    status
) VALUES
    (1, 1, 1, 'UniauthUserTenantId', '租户主键真实号段', 100001, 10, 0, 10, 1),
    (2, 1, 1, 'UniauthUserOrderId', '订单主键真实号段', 200001, 10, 0, 20, 1);
