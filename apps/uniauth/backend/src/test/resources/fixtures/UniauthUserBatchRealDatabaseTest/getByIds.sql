-- UniauthUserBatchRealDatabaseTest.getByIds Case 准备两条由批量主键查询命中的真实用户。
DELETE FROM UniauthUser;

INSERT INTO UniauthUser (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status)
VALUES
    (7101, 7, 7, 'batch-query-1', 'hash', '批量查询一', 20, 1),
    (7102, 7, 7, 'batch-query-2', 'hash', '批量查询二', 10, 1);
