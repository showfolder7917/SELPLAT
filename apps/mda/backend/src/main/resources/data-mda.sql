MERGE INTO CommonSequenceSegment KEY(seqCode) VALUES (
    1, 1, 1, 'MdaConnectionProfileId', 'MDA 连接配置主键', 10002, 1000, 0,
    'MdaConnectionProfile.id 公共号段', 10.00, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

MERGE INTO MdaConnectionProfile KEY(id) VALUES (
    10001, 1, 1, '本地 H2 演示库', 'H2', NULL, NULL,
    'mem:mda_target;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false', 'PUBLIC', 'sa', '', NULL, NULL,
    TRUE, 10.00, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
