-- MdaControlSchemaMigrationTest.freshInitialization Case
-- 空数据库由生产 db/mda/sql 下按表拆分的 schema 与 data 脚本完成首次初始化。
CREATE TABLE FreshInitializationCaseMarker (id INT PRIMARY KEY);
