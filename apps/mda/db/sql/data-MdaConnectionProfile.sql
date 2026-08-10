-- reference-data 是 SELPLAT 内置数据库管理目标；只在稳定连接名缺失时初始化，重启不覆盖页面修改。
INSERT INTO MdaConnectionProfile (
    id, connectionName, databaseType, host, port, databaseName, schemaName,
    username, password, customJdbcUrl, jdbcParameters, defaultAutoCommit, sortnum, status
) SELECT
    10004, 'Reference Data 数据库', 'H2', NULL, NULL,
    'file:./apps/reference-data/db/reference-data', 'PUBLIC',
    'sa', '123456', NULL,
    'MODE=MySQL;AUTO_SERVER=TRUE;DATABASE_TO_UPPER=false', TRUE, 10.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM MdaConnectionProfile WHERE connectionName = 'Reference Data 数据库'
);
