-- AI 工厂角色类型使用独立共享选项组；只补缺失记录，不覆盖工作台后续维护的名称、状态和排序。
INSERT INTO ReferenceDataType (
    id, code, tenantId, lastOperateUserId, optionSetCode, valueCode, parentTypeCode,
    nameZh, nameJa, nameEn, status, sortnum
)
SELECT 101010, 'type101010', 1, 1, 'optionSet103006', 'ENGINEER', NULL,
       '工程师', 'エンジニア', 'Engineer', 1, 20
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataType
    WHERE tenantId = 1 AND optionSetCode = 'optionSet103006' AND valueCode = 'ENGINEER'
);

-- AI 工厂门禁类型只有 AI 门禁；代码质量属于测试范围，不重复登记为门禁类型。
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101013,'type101013',1,1,'optionSet103007','AI_GATE',NULL,'AI门禁','AIゲート','AI gate',1,20 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103007' AND valueCode='AI_GATE');

-- 流程节点类型由引用数据工作台登记，AI 工厂画布只保存稳定 Key。
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101015,'type101015',1,1,'optionSet103008','START',NULL,'开始','開始','Start',1,70 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103008' AND valueCode='START');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101016,'type101016',1,1,'optionSet103008','ROLE',NULL,'角色','ロール','Role',1,60 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103008' AND valueCode='ROLE');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101017,'type101017',1,1,'optionSet103008','GATE',NULL,'门禁','ゲート','Gate',1,50 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103008' AND valueCode='GATE');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101018,'type101018',1,1,'optionSet103008','APPROVAL',NULL,'审批','承認','Approval',1,40 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103008' AND valueCode='APPROVAL');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101019,'type101019',1,1,'optionSet103008','CONDITION',NULL,'条件','条件','Condition',1,30 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103008' AND valueCode='CONDITION');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101020,'type101020',1,1,'optionSet103008','PARALLEL',NULL,'并行','並列','Parallel',1,20 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103008' AND valueCode='PARALLEL');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101021,'type101021',1,1,'optionSet103008','END',NULL,'结束','終了','End',1,10 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103008' AND valueCode='END');

-- 流程连线类型用于表达正常、成功、失败、条件与返回路径。
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101022,'type101022',1,1,'optionSet103009','SEQUENCE',NULL,'顺序','順序','Sequence',1,50 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103009' AND valueCode='SEQUENCE');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101023,'type101023',1,1,'optionSet103009','SUCCESS',NULL,'成功','成功','Success',1,40 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103009' AND valueCode='SUCCESS');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101024,'type101024',1,1,'optionSet103009','FAILURE',NULL,'失败','失敗','Failure',1,30 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103009' AND valueCode='FAILURE');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101025,'type101025',1,1,'optionSet103009','CONDITION',NULL,'条件','条件','Condition',1,20 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103009' AND valueCode='CONDITION');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101026,'type101026',1,1,'optionSet103009','RETURN',NULL,'返回','戻る','Return',1,10 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103009' AND valueCode='RETURN');

-- 流程版本状态和值由引用数据统一维护。
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101027,'type101027',1,1,'optionSet103010','DRAFT',NULL,'草稿','下書き','Draft',1,30 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103010' AND valueCode='DRAFT');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101028,'type101028',1,1,'optionSet103010','PUBLISHED',NULL,'已发布','公開済み','Published',1,20 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103010' AND valueCode='PUBLISHED');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101029,'type101029',1,1,'optionSet103010','RETIRED',NULL,'已停用','廃止','Retired',1,10 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103010' AND valueCode='RETIRED');

-- 流程与节点运行状态共享同一组选项，Python 只上报稳定 Key。
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101030,'type101030',1,1,'optionSet103011','NOT_STARTED',NULL,'未开始','未開始','Not started',1,60 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103011' AND valueCode='NOT_STARTED');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101031,'type101031',1,1,'optionSet103011','WAITING',NULL,'等待','待機','Waiting',1,50 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103011' AND valueCode='WAITING');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101032,'type101032',1,1,'optionSet103011','RUNNING',NULL,'执行中','実行中','Running',1,40 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103011' AND valueCode='RUNNING');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101033,'type101033',1,1,'optionSet103011','COMPLETED',NULL,'已完成','完了','Completed',1,30 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103011' AND valueCode='COMPLETED');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101034,'type101034',1,1,'optionSet103011','FAILED',NULL,'失败','失敗','Failed',1,20 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103011' AND valueCode='FAILED');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101035,'type101035',1,1,'optionSet103011','CANCELLED',NULL,'已取消','キャンセル','Cancelled',1,10 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103011' AND valueCode='CANCELLED');

-- 汇聚策略决定下游等待全部上游还是任一上游完成。
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101036,'type101036',1,1,'optionSet103012','ALL',NULL,'全部完成','すべて完了','All',1,20 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103012' AND valueCode='ALL');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101037,'type101037',1,1,'optionSet103012','ANY',NULL,'任一完成','いずれか完了','Any',1,10 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103012' AND valueCode='ANY');

-- 规则登记类型由引用数据工作台统一维护，页面与数据库只保存稳定 Key。
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101038,'type101038',1,1,'optionSet103013','RULE',NULL,'规则','ルール','Rule',1,20 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103013' AND valueCode='RULE');
INSERT INTO ReferenceDataType(id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum)
SELECT 101039,'type101039',1,1,'optionSet103013','AI_GATE',NULL,'AI门禁规则','AIゲートルール','AI gate rule',1,10 WHERE NOT EXISTS(SELECT 1 FROM ReferenceDataType WHERE tenantId=1 AND optionSetCode='optionSet103013' AND valueCode='AI_GATE');

-- 审核员与工程师共享同一选项组，使 AiRole.roleType 只保存稳定编码。
INSERT INTO ReferenceDataType (
    id, code, tenantId, lastOperateUserId, optionSetCode, valueCode, parentTypeCode,
    nameZh, nameJa, nameEn, status, sortnum
)
SELECT 101011, 'type101011', 1, 1, 'optionSet103006', 'REVIEWER', NULL,
       '审核员', 'レビュアー', 'Reviewer', 1, 10
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataType
    WHERE tenantId = 1 AND optionSetCode = 'optionSet103006' AND valueCode = 'REVIEWER'
);
