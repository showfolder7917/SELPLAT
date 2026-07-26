-- UniauthUserGetByIdRealDatabaseTest.foundNumber Case 清空用户表，确保数字主键只命中当前测试方法准备的唯一记录。
DELETE FROM UniauthUser;

-- 当前记录用于验证 Number 类型主键经过真实 DAO 主键查询后返回完整用户详情。
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
    (2101, 2, 9, 'detail-number', 'fixture-hash', '数字主键详情用户', 10.00, 1);
