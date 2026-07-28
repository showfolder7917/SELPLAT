-- SequenceGeneratorBoundaryTest.concurrentContention Case 建立共享缓存与多实例乐观锁真实竞争号段。
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
) VALUES
    (3, 1, 1, 'SharedConcurrentCode', '共享缓存真实并发号段', 1000, 100, 0, 10, 1),
    (4, 1, 1, 'ContendedCode', '多实例乐观锁真实竞争号段', 2000, 1, 0, 20, 1);
