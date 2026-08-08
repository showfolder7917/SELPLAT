-- 旧 MDA 控制库曾误初始化 UniauthUserId；正确 MDA 坐标不存在时保留原记录和游标并迁移归属。
UPDATE CommonSequenceSegment
   SET seqCode = 'MdaConnectionProfileId',
       seqName = 'MDA连接配置主键号段',
       nextStartId = GREATEST(
           nextStartId,
           100000,
           COALESCE((SELECT MAX(id) + 1 FROM MdaConnectionProfile), 100000)),
       remark = '按模块缓存号段生成MDA连接配置主键',
       status = 1,
       updatedAt = CURRENT_TIMESTAMP
 WHERE seqCode = 'UniauthUserId'
   AND NOT EXISTS (
       SELECT 1
         FROM CommonSequenceSegment existingSegment
        WHERE existingSegment.seqCode = 'MdaConnectionProfileId'
   );

-- 正确 MDA 坐标已存在时，旧坐标由 Uniauth 私有库同名记录替代，从 MDA 库移除以避免双库路由冲突。
DELETE FROM CommonSequenceSegment
 WHERE seqCode = 'UniauthUserId';

-- MdaConnectionProfileId 是连接配置表唯一主键号段；重复启动不得覆盖已推进游标和后台维护值。
INSERT INTO CommonSequenceSegment (
    tenantId,
    lastOperateUserId,
    seqCode,
    seqName,
    nextStartId,
    stepSize,
    versionNo,
    remark,
    sortnum,
    status)
SELECT
    1,
    1,
    'MdaConnectionProfileId',
    'MDA连接配置主键号段',
    GREATEST(100000, COALESCE((SELECT MAX(id) + 1 FROM MdaConnectionProfile), 100000)),
    1000,
    0,
    '按模块缓存号段生成MDA连接配置主键',
    10.00,
    1
WHERE NOT EXISTS (
    SELECT 1
      FROM CommonSequenceSegment
     WHERE seqCode = 'MdaConnectionProfileId'
);
