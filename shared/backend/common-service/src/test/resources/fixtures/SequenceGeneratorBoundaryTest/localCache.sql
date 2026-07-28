-- SequenceGeneratorBoundaryTest.localCache Case 建立真实号段并验证生产本地缓存只推进一次数据库游标。
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

INSERT INTO CommonSequenceSegment (
    id, tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, sortnum, status
) VALUES (
    1, 1, 1, 'CacheCode', '真实缓存号段', 100, 10, 0, 10, 1
);
