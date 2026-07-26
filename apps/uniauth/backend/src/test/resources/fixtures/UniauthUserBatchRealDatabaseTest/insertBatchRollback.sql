-- UniauthUserBatchRealDatabaseTest.insertBatchRollback Case 清空用户表并重建批量回滚真实号段。
DELETE FROM UniauthUser;
DELETE FROM CommonSequenceSegment;

INSERT INTO CommonSequenceSegment (
    id, tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, sortnum, status
) VALUES (
    75, 7, 7, 'UniauthUserId', '批量回滚用户号段', 750000, 1000, 0, 10, 1
);
