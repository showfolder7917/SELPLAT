-- MdaControlSchemaMigrationTest.repeatedInitialization Case
-- 空数据库连续执行两次生产初始化脚本，验证结构与稳定号段幂等。
CREATE TABLE RepeatedInitializationCaseMarker (id INT PRIMARY KEY);
