-- UniauthUserGetStoreRealDatabaseTest.defaultSortnum Case 先清空用户表，保证返回顺序只由当前测试方法的数据决定。
DELETE FROM UniauthUser;

-- id 与 sortnum 故意采用不同顺序，确保测试能识别 getStore 是否真正使用默认 sortnum 倒序。
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
    (1001, 1, 1, 'sort-low', 'fixture-hash', '低排序用户', 10.00, 1),
    (1003, 1, 1, 'sort-high', 'fixture-hash', '高排序用户', 30.00, 1),
    (1002, 1, 1, 'sort-middle', 'fixture-hash', '中排序用户', 20.00, 1);
