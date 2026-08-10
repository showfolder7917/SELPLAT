-- 初始化 reference-data/resource-kind 的真实多级右键菜单。
INSERT INTO ReferenceDataContextMenuItem (id, typeId, parentId, itemCode, labelZh, labelJa, labelEn, icon, command, attributesJson, disabled, status, sortnum)
SELECT 900000003001, t.id, NULL, 'create', '新建', '新規作成', 'Create', 'plus', NULL,
       '{"menuKind":"GROUP"}', FALSE, 1, 10
FROM ReferenceDataType t
WHERE t.projectCode = 'reference-data' AND t.resourceCode = 'resource-kind'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataContextMenuItem m WHERE m.typeId = t.id AND m.itemCode = 'create');

INSERT INTO ReferenceDataContextMenuItem (id, typeId, parentId, itemCode, labelZh, labelJa, labelEn, icon, command, attributesJson, disabled, status, sortnum)
SELECT 900000003002, t.id, p.id, 'create-tree-resource', '新建树资源', 'ツリーリソースを作成', 'Create tree resource',
       'tree', 'CREATE_TREE_RESOURCE', '{"resourceKind":"TREE"}', FALSE, 1, 10
FROM ReferenceDataType t
JOIN ReferenceDataContextMenuItem p ON p.typeId = t.id AND p.itemCode = 'create'
WHERE t.projectCode = 'reference-data' AND t.resourceCode = 'resource-kind'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataContextMenuItem m WHERE m.typeId = t.id AND m.itemCode = 'create-tree-resource');

INSERT INTO ReferenceDataContextMenuItem (id, typeId, parentId, itemCode, labelZh, labelJa, labelEn, icon, command, attributesJson, disabled, status, sortnum)
SELECT 900000003003, t.id, p.id, 'create-option-resource', '新建选项资源', '選択肢リソースを作成', 'Create option resource',
       'list', 'CREATE_OPTION_RESOURCE', '{"resourceKind":"OPTIONS"}', FALSE, 1, 20
FROM ReferenceDataType t
JOIN ReferenceDataContextMenuItem p ON p.typeId = t.id AND p.itemCode = 'create'
WHERE t.projectCode = 'reference-data' AND t.resourceCode = 'resource-kind'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataContextMenuItem m WHERE m.typeId = t.id AND m.itemCode = 'create-option-resource');

INSERT INTO ReferenceDataContextMenuItem (id, typeId, parentId, itemCode, labelZh, labelJa, labelEn, icon, command, attributesJson, disabled, status, sortnum)
SELECT 900000003004, t.id, NULL, 'refresh', '刷新', '更新', 'Refresh', 'refresh', 'REFRESH_RESOURCE_KIND',
       '{"menuKind":"ACTION"}', FALSE, 1, 20
FROM ReferenceDataType t
WHERE t.projectCode = 'reference-data' AND t.resourceCode = 'resource-kind'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataContextMenuItem m WHERE m.typeId = t.id AND m.itemCode = 'refresh');
