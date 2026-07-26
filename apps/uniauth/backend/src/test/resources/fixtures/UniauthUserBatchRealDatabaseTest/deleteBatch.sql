-- UniauthUserBatchRealDatabaseTest.deleteBatch Case 准备两条必须保留物理记录的真实用户。
DELETE FROM UniauthUser;

INSERT INTO UniauthUser (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status)
VALUES
    (7301, 7, 7, 'batch-delete-1', 'hash', '批量删除一', 20, 1),
    (7302, 7, 7, 'batch-delete-2', 'hash', '批量删除二', 10, 1);
