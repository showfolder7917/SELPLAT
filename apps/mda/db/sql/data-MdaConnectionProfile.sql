-- 旧版自动创建的默认工作库已经退出架构；该记录由空状态新增入口替代，不再作为可选连接保留。
DELETE FROM MdaConnectionProfile
 WHERE connectionName = 'MDA 本地工作库'
   AND (databaseName LIKE '%mda-workspace%' OR customJdbcUrl LIKE '%mda-workspace%');
