-- UniauthUserControllerRealDatabaseTest.publicMethodResponses Case 重建控制器九个入口使用的真实用户与号段。
DELETE FROM UniauthUser;
DELETE FROM CommonSequenceSegment;

INSERT INTO CommonSequenceSegment (
    id, tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, sortnum, status
) VALUES (
    81, 8, 8, 'UniauthUserId', '控制器真实链路用户号段', 8200, 1000, 0, 10, 1
);

INSERT INTO UniauthUser (
    id, tenantId, lastOperateUserId, loginName, passwordHash, displayName, sortnum, status
) VALUES
    (8101, 8, 8, 'controller-real-low', 'fixture-hash', '控制器真实用户一', 10, 1),
    (8102, 8, 8, 'controller-real-high', 'fixture-hash', '控制器真实用户二', 20, 1);
