-- BaseServiceImplRealDatabaseTest.defaultCrud Case 建立基础 Service 全部默认 CRUD 使用的真实业务表与号段。
CREATE TABLE SharedServiceFixture (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL,
    lastOperateUserId BIGINT NOT NULL,
    name VARCHAR(128) NOT NULL,
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

INSERT INTO SharedServiceFixture (
    id, tenantId, lastOperateUserId, name, sortnum, status
) VALUES
    (1, 1, 1, 'fixture-one', 10, 1),
    (2, 1, 1, 'fixture-two', 20, 1);

INSERT INTO CommonSequenceSegment (
    id, tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, sortnum, status
) VALUES (
    1, 1, 1, 'SharedServiceFixtureId', '基础 Service 真实主键号段', 100, 1000, 0, 10, 1
);
