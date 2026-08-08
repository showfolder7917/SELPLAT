-- SequenceGeneratorRealDatabaseTest.routeProjectDataSources Case
CREATE SCHEMA MDA_DB;
CREATE SCHEMA UNIAUTH_DB;

CREATE TABLE MDA_DB.CommonSequenceSegment (
    seqCode VARCHAR(64) PRIMARY KEY,
    nextStartId BIGINT NOT NULL,
    stepSize INT NOT NULL,
    versionNo INT NOT NULL,
    status INT NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE UNIAUTH_DB.CommonSequenceSegment (
    seqCode VARCHAR(64) PRIMARY KEY,
    nextStartId BIGINT NOT NULL,
    stepSize INT NOT NULL,
    versionNo INT NOT NULL,
    status INT NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO MDA_DB.CommonSequenceSegment (seqCode, nextStartId, stepSize, versionNo, status)
VALUES ('MdaConnectionProfileId', 100000, 1000, 0, 1);

INSERT INTO UNIAUTH_DB.CommonSequenceSegment (seqCode, nextStartId, stepSize, versionNo, status)
VALUES ('UniauthUserId', 200000, 1000, 0, 1);
