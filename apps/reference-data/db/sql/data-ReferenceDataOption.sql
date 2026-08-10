-- 初始化 reference-data/resource-kind 的两个真实下拉选项。
INSERT INTO ReferenceDataOption (id, typeId, optionValue, labelZh, labelJa, labelEn, groupCode, attributesJson, disabled, status, sortnum)
SELECT 900000002001, t.id, 'TREE', '树形资源', 'ツリーリソース', 'Tree resource',
       'reference-data-resource-kind', '{"resourceKind":"TREE"}', FALSE, 1, 10
FROM ReferenceDataType t
WHERE t.projectCode = 'reference-data' AND t.resourceCode = 'resource-kind'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataOption o WHERE o.typeId = t.id AND o.optionValue = 'TREE');

INSERT INTO ReferenceDataOption (id, typeId, optionValue, labelZh, labelJa, labelEn, groupCode, attributesJson, disabled, status, sortnum)
SELECT 900000002002, t.id, 'OPTIONS', '类型选项资源', '選択肢リソース', 'Option resource',
       'reference-data-resource-kind', '{"resourceKind":"OPTIONS"}', FALSE, 1, 20
FROM ReferenceDataType t
WHERE t.projectCode = 'reference-data' AND t.resourceCode = 'resource-kind'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataOption o WHERE o.typeId = t.id AND o.optionValue = 'OPTIONS');
