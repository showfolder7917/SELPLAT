-- UniauthUserDeleteRealDatabaseTest.softDelete Case 清空用户表，确保逻辑删除状态只来自当前测试方法。
DELETE FROM UniauthUser;

-- 有效用户记录用于验证 delete 把 status 更新为零并保留数据库记录。
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
    (5101, 5, 1, 'soft-delete-user', 'fixture-hash', '待逻辑删除用户', 10.00, 1);
