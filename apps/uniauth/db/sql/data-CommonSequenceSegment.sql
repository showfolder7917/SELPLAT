MERGE INTO CommonSequenceSegment (id, tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, remark, sortnum, status)
KEY(id)
VALUES
  (1, 1, 1, 'UniauthUserId', '统一认证用户主键号段', 100000, 1000, 0, '按模块缓存号段生成主键', 10.00, 1);
