-- 历史环境可能曾以错误字符集写入显示名；数据库稳定路径是可靠身份，插入默认记录前先纠正名称以避免重复。
UPDATE MdaConnectionProfile
SET connectionName = 'Reference Data 数据库', updatedAt = CURRENT_TIMESTAMP
WHERE databaseName LIKE '%apps/reference-data/db/reference-data%'
  AND connectionName <> 'Reference Data 数据库';

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

-- 历史环境可能曾以错误字符集写入显示名；数据库稳定路径是可靠身份，插入默认记录前先纠正名称以避免重复。
UPDATE MdaConnectionProfile
SET connectionName = 'N2 蓝宝书1000题数据库', updatedAt = CURRENT_TIMESTAMP
WHERE databaseName LIKE '%apps/japanese/db/japanese%'
  AND connectionName <> 'N2 蓝宝书1000题数据库';

-- N2 蓝宝书1000题是 SELPLAT 内置的日语题库；只在稳定连接名缺失时恢复，不覆盖工作台中已修改的参数。
INSERT INTO MdaConnectionProfile (
    id, connectionName, databaseType, host, port, databaseName, schemaName,
    username, password, customJdbcUrl, jdbcParameters, defaultAutoCommit, sortnum, status
) SELECT
    10005, 'N2 蓝宝书1000题数据库', 'H2', NULL, NULL,
    'file:./apps/japanese/db/japanese', 'PUBLIC',
    'sa', '123456', NULL,
    'MODE=MySQL;AUTO_SERVER=TRUE;DATABASE_TO_UPPER=false', TRUE, 20.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM MdaConnectionProfile WHERE connectionName = 'N2 蓝宝书1000题数据库'
);

-- AI 工厂数据库已经归入稳定应用 db 目录；按数据库路径纠正显示名，避免历史手工连接重复出现。
UPDATE MdaConnectionProfile
SET connectionName = 'AI 工厂数据库', updatedAt = CURRENT_TIMESTAMP
WHERE databaseName LIKE '%apps/ai-factiory/db/aifactory%'
  AND connectionName <> 'AI 工厂数据库';

-- AI 工厂是 SELPLAT 内置管理目标；MDA 只保存连接定义，不复制或修改 AI 工厂业务数据。
INSERT INTO MdaConnectionProfile (
    id, connectionName, databaseType, host, port, databaseName, schemaName,
    username, password, customJdbcUrl, jdbcParameters, defaultAutoCommit, sortnum, status
) SELECT
    10006, 'AI 工厂数据库', 'H2', NULL, NULL,
    'file:./apps/ai-factiory/db/aifactory', 'PUBLIC',
    'sa', '', NULL,
    'MODE=MySQL;AUTO_SERVER=TRUE;DATABASE_TO_UPPER=false', TRUE, 30.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM MdaConnectionProfile WHERE connectionName = 'AI 工厂数据库'
);
