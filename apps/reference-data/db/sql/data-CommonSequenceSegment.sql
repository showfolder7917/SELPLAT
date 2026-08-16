-- 无实体表的共享逻辑对象使用通用号段；当前用于 optionSetCode，未来同类逻辑编码继续复用。
INSERT INTO CommonSequenceSegment
    (tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, remark, sortnum, status)
SELECT 1, 1, 'ReferenceDataObjectId', '引用数据通用逻辑对象', 101000, 1000, 0,
       '无独立实体表的通用逻辑编码号段；当前用于 optionSetCode，不用于六张业务表主键', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataObjectId');

-- 六张实体表各用自己的主键号段；code 由对象前缀与该表 id 直接拼接。
INSERT INTO CommonSequenceSegment
    (tenantId,lastOperateUserId,seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 1,1,'ReferenceDataControlLayoutId','页面控件主键',
       CASE WHEN currentId.nextId>101000 THEN currentId.nextId ELSE 101000 END,
       1000,0,'ReferenceDataControlLayout 独立主键号段',10,1
FROM (SELECT COALESCE(MAX(id),100999)+1 nextId FROM ReferenceDataControlLayout) currentId
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='ReferenceDataControlLayoutId');
INSERT INTO CommonSequenceSegment
    (tenantId,lastOperateUserId,seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 1,1,'ReferenceDataTableId','表格主键',
       CASE WHEN currentId.nextId>101000 THEN currentId.nextId ELSE 101000 END,
       1000,0,'ReferenceDataTable 独立主键号段',20,1
FROM (SELECT COALESCE(MAX(id),100999)+1 nextId FROM ReferenceDataTable) currentId
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='ReferenceDataTableId');
INSERT INTO CommonSequenceSegment
    (tenantId,lastOperateUserId,seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 1,1,'ReferenceDataTableElementId','表格元素主键',
       CASE WHEN currentId.nextId>101000 THEN currentId.nextId ELSE 101000 END,
       1000,0,'ReferenceDataTableElement 独立主键号段',30,1
FROM (SELECT COALESCE(MAX(id),100999)+1 nextId FROM ReferenceDataTableElement) currentId
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='ReferenceDataTableElementId');
INSERT INTO CommonSequenceSegment
    (tenantId,lastOperateUserId,seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 1,1,'ReferenceDataTreeNodeId','树节点主键',
       CASE WHEN currentId.nextId>101000 THEN currentId.nextId ELSE 101000 END,
       1000,0,'ReferenceDataTreeNode 独立主键号段',40,1
FROM (SELECT COALESCE(MAX(id),100999)+1 nextId FROM ReferenceDataTreeNode) currentId
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='ReferenceDataTreeNodeId');
INSERT INTO CommonSequenceSegment
    (tenantId,lastOperateUserId,seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 1,1,'ReferenceDataTypeId','数据类型主键',
       CASE WHEN currentId.nextId>101000 THEN currentId.nextId ELSE 101000 END,
       1000,0,'ReferenceDataType 独立主键号段',50,1
FROM (SELECT COALESCE(MAX(id),100999)+1 nextId FROM ReferenceDataType) currentId
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='ReferenceDataTypeId');
INSERT INTO CommonSequenceSegment
    (tenantId,lastOperateUserId,seqCode,seqName,nextStartId,stepSize,versionNo,remark,sortnum,status)
SELECT 1,1,'ReferenceDataWindowId','Window主键',
       CASE WHEN currentId.nextId>101000 THEN currentId.nextId ELSE 101000 END,
       1000,0,'ReferenceDataWindow 独立主键号段',60,1
FROM (SELECT COALESCE(MAX(id),100999)+1 nextId FROM ReferenceDataWindow) currentId
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode='ReferenceDataWindowId');
