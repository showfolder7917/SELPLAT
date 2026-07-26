-- UniauthUserGetByIdRealDatabaseTest.notFound Case 清空用户表，确保不存在结果不是被初始化数据偶然命中。
DELETE FROM UniauthUser;
