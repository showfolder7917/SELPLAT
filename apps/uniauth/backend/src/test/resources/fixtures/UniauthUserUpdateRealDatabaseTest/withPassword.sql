-- UniauthUserUpdateRealDatabaseTest.withPassword Case 清空用户表，确保密码转换结果只作用于当前测试方法准备的目标记录。
DELETE FROM UniauthUser;

-- 原摘要与测试提交的新密码不同，用于验证 update 已将明文转换并真实写入数据库。
INSERT INTO UniauthUser (
    id,
    tenantId,
    lastOperateUserId,
    loginName,
    passwordHash,
    displayName,
    sortnum,
    status
) VALUES
    (4102, 4, 1, 'update-with-password', 'old-password-hash', '密码更新用户', 10.00, 1);
