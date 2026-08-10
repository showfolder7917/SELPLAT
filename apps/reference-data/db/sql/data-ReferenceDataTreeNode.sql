-- 初始化 reference-data/resource-kind 的真实树节点；只按类型和节点编码补充缺失记录。
INSERT INTO ReferenceDataTreeNode (id, typeId, parentId, nodeCode, nodeValue, labelZh, labelJa, labelEn, attributesJson, status, sortnum)
SELECT 900000001001, t.id, NULL, 'resource-kind-root', 'ALL', '引用数据资源类型', '参照データリソース種別',
       'Reference data resource types', '{"resourceKind":"ROOT"}', 1, 10
FROM ReferenceDataType t
WHERE t.projectCode = 'reference-data' AND t.resourceCode = 'resource-kind'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataTreeNode n WHERE n.typeId = t.id AND n.nodeCode = 'resource-kind-root');

INSERT INTO ReferenceDataTreeNode (id, typeId, parentId, nodeCode, nodeValue, labelZh, labelJa, labelEn, attributesJson, status, sortnum)
SELECT 900000001002, t.id, p.id, 'resource-kind-tree', 'TREE', '树形资源', 'ツリーリソース',
       'Tree resource', '{"resourceKind":"TREE"}', 1, 10
FROM ReferenceDataType t
JOIN ReferenceDataTreeNode p ON p.typeId = t.id AND p.nodeCode = 'resource-kind-root'
WHERE t.projectCode = 'reference-data' AND t.resourceCode = 'resource-kind'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataTreeNode n WHERE n.typeId = t.id AND n.nodeCode = 'resource-kind-tree');

INSERT INTO ReferenceDataTreeNode (id, typeId, parentId, nodeCode, nodeValue, labelZh, labelJa, labelEn, attributesJson, status, sortnum)
SELECT 900000001003, t.id, p.id, 'resource-kind-options', 'OPTIONS', '类型选项资源', '選択肢リソース',
       'Option resource', '{"resourceKind":"OPTIONS"}', 1, 20
FROM ReferenceDataType t
JOIN ReferenceDataTreeNode p ON p.typeId = t.id AND p.nodeCode = 'resource-kind-root'
WHERE t.projectCode = 'reference-data' AND t.resourceCode = 'resource-kind'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataTreeNode n WHERE n.typeId = t.id AND n.nodeCode = 'resource-kind-options');

-- Japanese N2 蓝宝书题库分类树迁入 ReferenceDataTreeNode 表。
INSERT INTO ReferenceDataTreeNode (id, typeId, parentId, nodeCode, nodeValue, labelZh, labelJa, labelEn, attributesJson, status, sortnum)
SELECT 900000001004, t.id, NULL, 'n2-blue-book-root', 'ALL', 'N2 蓝宝书1000题', 'N2 ブルーブック1000問',
       'N2 Blue Book 1000 Questions', '{"questionType":"ALL"}', 1, 10
FROM ReferenceDataType t
WHERE t.projectCode = 'japanese' AND t.resourceCode = 'n2-blue-book-question'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataTreeNode n WHERE n.typeId = t.id AND n.nodeCode = 'n2-blue-book-root');

INSERT INTO ReferenceDataTreeNode (id, typeId, parentId, nodeCode, nodeValue, labelZh, labelJa, labelEn, attributesJson, status, sortnum)
SELECT 900000001005, t.id, p.id, 'n2-blue-book-reading', 'READING', '语音・读音题', '音声・読み方問題',
       'Audio and reading', '{"questionType":"READING"}', 1, 10
FROM ReferenceDataType t JOIN ReferenceDataTreeNode p ON p.typeId = t.id AND p.nodeCode = 'n2-blue-book-root'
WHERE t.projectCode = 'japanese' AND t.resourceCode = 'n2-blue-book-question'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataTreeNode n WHERE n.typeId = t.id AND n.nodeCode = 'n2-blue-book-reading');

INSERT INTO ReferenceDataTreeNode (id, typeId, parentId, nodeCode, nodeValue, labelZh, labelJa, labelEn, attributesJson, status, sortnum)
SELECT 900000001006, t.id, p.id, 'n2-blue-book-kanji', 'KANJI', '汉字题', '漢字問題',
       'Kanji', '{"questionType":"KANJI"}', 1, 20
FROM ReferenceDataType t JOIN ReferenceDataTreeNode p ON p.typeId = t.id AND p.nodeCode = 'n2-blue-book-root'
WHERE t.projectCode = 'japanese' AND t.resourceCode = 'n2-blue-book-question'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataTreeNode n WHERE n.typeId = t.id AND n.nodeCode = 'n2-blue-book-kanji');

INSERT INTO ReferenceDataTreeNode (id, typeId, parentId, nodeCode, nodeValue, labelZh, labelJa, labelEn, attributesJson, status, sortnum)
SELECT 900000001007, t.id, p.id, 'n2-blue-book-grammar', 'GRAMMAR', '语法题', '文法問題',
       'Grammar', '{"questionType":"GRAMMAR"}', 1, 30
FROM ReferenceDataType t JOIN ReferenceDataTreeNode p ON p.typeId = t.id AND p.nodeCode = 'n2-blue-book-root'
WHERE t.projectCode = 'japanese' AND t.resourceCode = 'n2-blue-book-question'
  AND NOT EXISTS (SELECT 1 FROM ReferenceDataTreeNode n WHERE n.typeId = t.id AND n.nodeCode = 'n2-blue-book-grammar');
