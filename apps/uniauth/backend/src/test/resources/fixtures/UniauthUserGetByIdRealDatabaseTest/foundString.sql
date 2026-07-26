-- UniauthUserGetByIdRealDatabaseTest.foundString Case 清空用户表，确保字符串主键直接透传后只命中当前测试方法准备的记录。
DELETE FROM UniauthUser;

-- 当前记录用于验证前端字符串 id 由 CommonParam 直接进入真实 DAO 主键查询。
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
    (2102, 2, 9, 'detail-string', 'fixture-hash', '字符串主键详情用户', 10.00, 1);
