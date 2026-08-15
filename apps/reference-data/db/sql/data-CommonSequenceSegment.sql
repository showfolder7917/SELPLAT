-- 六张元数据业务表共用项目级对象号段；同一个数字后缀只会分配给一个对象。
INSERT INTO CommonSequenceSegment
    (tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, remark, sortnum, status)
SELECT 1, 1, 'ReferenceDataObjectId', '引用数据全局对象主键', 101000, 1000, 0,
       'Reference Data 六张元数据表共享号段，用于生成跨表唯一 code', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataObjectId');
