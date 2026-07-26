-- UniauthUserBatchRealDatabaseTest.updateBatch Case 准备两条使用不同更新字段结构的真实用户。
DELETE FROM UniauthUser;

INSERT INTO UniauthUser (id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status)
VALUES
    (7201, 7, 7, 'batch-update-1', 'old-hash-1', '更新前一', 20, 1),
    (7202, 7, 7, 'batch-update-2', 'old-hash-2', '更新前二', 10, 1);
