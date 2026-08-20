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
