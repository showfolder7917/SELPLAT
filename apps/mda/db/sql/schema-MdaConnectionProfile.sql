-- MdaConnectionProfile 保存页面维护的目标数据库连接配置；页面 SQL 和目标库业务数据不会复制到控制库。
CREATE TABLE IF NOT EXISTS MdaConnectionProfile (
    -- id 作为连接配置主键，由 CommonSequenceSegment 中的 MdaConnectionProfileId 号段统一生成。
    id BIGINT PRIMARY KEY,
    -- connectionName 保存页面左侧连接列表的显示名称，要求全局唯一以避免用户选错连接。
    connectionName VARCHAR(120) NOT NULL UNIQUE,
    -- databaseType 保存数据库类型，当前允许 H2、MYSQL、SQLSERVER、ORACLE、POSTGRESQL。
    databaseType VARCHAR(20) NOT NULL,
    -- host 保存目标数据库服务器主机名或 IP；H2 使用完整路径或自定义 URL 时可以为空。
    host VARCHAR(255),
    -- port 保存目标数据库监听端口；未填写时服务按数据库类型使用默认端口。
    port INTEGER,
    -- databaseName 保存数据库名称；H2 保存文件或内存库路径，Oracle 保存 service name。
    databaseName VARCHAR(240) NOT NULL,
    -- schemaName 保存连接后的默认 schema，页面浏览结构时可用于定位用户优先关注的模式。
    schemaName VARCHAR(120),
    -- username 保存连接目标数据库使用的登录账号，实际 SQL 可执行范围由该账号决定。
    username VARCHAR(120),
    -- password 明文保存目标数据库口令；MDA 仅作为不部署上线的本地开发工具使用。
    password VARCHAR(1000) NOT NULL DEFAULT '',
    -- customJdbcUrl 保存人工填写的完整 JDBC URL；存在时优先使用，不再根据 host、port 等字段自动拼接。
    customJdbcUrl VARCHAR(1000),
    -- jdbcParameters 保存自动拼接 JDBC URL 时追加的厂商参数，例如 useSSL=false 或 sslmode=disable。
    jdbcParameters VARCHAR(1000),
    -- defaultAutoCommit 保存该连接执行 SQL 时的默认自动提交设置，页面仍可在单次执行前覆盖。
    defaultAutoCommit BOOLEAN NOT NULL DEFAULT TRUE,
    -- sortnum 保存连接在页面左侧列表中的手工排序值，数值越小越靠前。
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    -- status 保存逻辑状态，1 表示页面可用，0 表示已逻辑删除且不再显示。
    status INTEGER NOT NULL DEFAULT 1,
    -- createdAt 保存连接配置首次创建时间，便于审计配置来源。
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存连接配置最后更新时间，便于判断配置是否近期发生变更。
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 兼容 identity 旧库：保留现有 id 与连接记录，只移除数据库自增属性，后续显式写入公共号段生成值。
ALTER TABLE MdaConnectionProfile ALTER COLUMN id BIGINT;

-- 兼容已经由旧版本创建的控制库：新增明文字段并移除不再使用的密文字段。
ALTER TABLE MdaConnectionProfile ADD COLUMN IF NOT EXISTS password VARCHAR(1000) NOT NULL DEFAULT '';
ALTER TABLE MdaConnectionProfile DROP COLUMN IF EXISTS passwordCiphertext;

-- MDA 只保存本地连接定义，旧库的租户和操作人列升级时删除，其他连接数据保持不变。
ALTER TABLE MdaConnectionProfile DROP COLUMN IF EXISTS tenantId;
ALTER TABLE MdaConnectionProfile DROP COLUMN IF EXISTS lastOperateUserId;

COMMENT ON TABLE MdaConnectionProfile IS 'MDA 目标数据库连接配置表';
COMMENT ON COLUMN MdaConnectionProfile.id IS '连接配置主键，由公共号段生成';
COMMENT ON COLUMN MdaConnectionProfile.connectionName IS '页面显示的唯一连接名称';
COMMENT ON COLUMN MdaConnectionProfile.databaseType IS '数据库类型：H2、MYSQL、SQLSERVER、ORACLE、POSTGRESQL';
COMMENT ON COLUMN MdaConnectionProfile.host IS '目标数据库服务器主机名或IP';
COMMENT ON COLUMN MdaConnectionProfile.port IS '目标数据库监听端口';
COMMENT ON COLUMN MdaConnectionProfile.databaseName IS '数据库名、H2路径或Oracle服务名';
COMMENT ON COLUMN MdaConnectionProfile.schemaName IS '连接后的默认Schema';
COMMENT ON COLUMN MdaConnectionProfile.username IS '目标数据库登录账号';
COMMENT ON COLUMN MdaConnectionProfile.password IS '本地开发工具使用的明文连接口令';
COMMENT ON COLUMN MdaConnectionProfile.customJdbcUrl IS '优先使用的完整JDBC URL';
COMMENT ON COLUMN MdaConnectionProfile.jdbcParameters IS '自动拼接JDBC URL时追加的厂商参数';
COMMENT ON COLUMN MdaConnectionProfile.defaultAutoCommit IS 'SQL执行默认自动提交开关';
COMMENT ON COLUMN MdaConnectionProfile.sortnum IS '页面连接列表排序值';
COMMENT ON COLUMN MdaConnectionProfile.status IS '逻辑状态，1有效、0逻辑删除';
COMMENT ON COLUMN MdaConnectionProfile.createdAt IS '数据创建时间';
COMMENT ON COLUMN MdaConnectionProfile.updatedAt IS '数据最后更新时间';
