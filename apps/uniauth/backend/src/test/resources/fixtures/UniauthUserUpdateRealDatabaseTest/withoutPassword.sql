-- UniauthUserUpdateRealDatabaseTest.withoutPassword Case 清空用户表，确保更新结果只来自当前测试方法准备的目标记录。
DELETE FROM UniauthUser;

-- 原密码摘要用于证明未传 password 时 update 不会覆盖已有密码。
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
    (4101, 4, 1, 'update-without-password', 'original-password-hash', '更新前名称', 10.00, 1);
