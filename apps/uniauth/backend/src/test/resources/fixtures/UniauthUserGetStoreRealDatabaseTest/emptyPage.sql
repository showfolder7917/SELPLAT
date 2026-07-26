-- UniauthUserGetStoreRealDatabaseTest.emptyPage Case 清空用户表，确保分页总数和空页结果来自当前测试方法的独立数据。
DELETE FROM UniauthUser;

-- 当前 Case 只有两条记录，调用第三页时应返回空列表但仍保留真实总数。
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
    (1201, 1, 1, 'page-first', 'fixture-hash', '分页用户一', 20.00, 1),
    (1202, 1, 1, 'page-second', 'fixture-hash', '分页用户二', 10.00, 1);
