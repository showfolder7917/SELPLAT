-- UniauthUserBatchRealDatabaseTest.insertBatch Case 清空用户表并重建批量新增真实号段。
DELETE FROM UniauthUser;
DELETE FROM CommonSequenceSegment;

INSERT INTO CommonSequenceSegment (
    id, tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, sortnum, status
) VALUES (
    74, 7, 7, 'UniauthUserId', '批量新增用户号段', 740000, 1000, 0, 10, 1
);
