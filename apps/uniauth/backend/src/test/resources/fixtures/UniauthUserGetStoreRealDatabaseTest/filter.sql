-- UniauthUserGetStoreRealDatabaseTest.filter Case 清空用户表，避免初始化账号进入当前测试方法的筛选结果。
DELETE FROM UniauthUser;

-- 当前 Case 同时提供两个命中项和一个非命中项，验证 Like 条件及命中结果内部默认排序。
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
    (1101, 1, 1, 'alpha-low', 'fixture-hash', 'Alpha 低排序用户', 10.00, 1),
    (1102, 1, 1, 'beta', 'fixture-hash', '非命中用户', 30.00, 1),
    (1103, 1, 1, 'alpha-high', 'fixture-hash', 'Alpha 高排序用户', 20.00, 1);
