SET REFERENTIAL_INTEGRITY FALSE;
DELETE FROM ReferenceDataControlLayout;
DELETE FROM ReferenceDataWindow;
DELETE FROM ReferenceDataTableElement;
DELETE FROM ReferenceDataTreeNode;
DELETE FROM ReferenceDataTable;
DELETE FROM ReferenceDataType;
DELETE FROM CommonSequenceSegment;
SET REFERENTIAL_INTEGRITY TRUE;
INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, status
) VALUES (1, 1, 'ReferenceDataObjectId', '引用数据全局对象主键', 101000, 100, 0, 1);
INSERT INTO ReferenceDataType (
    id, code, tenantId, lastOperateUserId, projectCode, resourceCode, type, nameZh, nameJa, nameEn,
    descriptionZh, descriptionJa, descriptionEn, status, sortnum
) VALUES
    (100001, 'type100001', 1, 1, 'reference-data', 'resource-kind', 'TREE', '引用数据资源类型', '参照データ種別', 'Reference data types',
     '平台内置类型', 'プラットフォーム組み込み種別', 'Built-in type', 1, 100),
    (100002, 'cms100002', 1, 1, 'cms', 'article-category', 'DROPDOWN', '文章分类', '記事カテゴリ', 'Article categories',
     '文章分类说明', '記事カテゴリ説明', 'Article category description', 1, 80),
    (100003, 'cms100003', 1, 1, 'cms', 'archive-category', 'DROPDOWN', '归档分类', 'アーカイブカテゴリ', 'Archive categories',
     '归档分类说明', 'アーカイブカテゴリ説明', 'Archive category description', 2, 70),
    (100004, 'type100004', 1, 1, 'reference-data', 'custom-single', 'GRID_MENU', '自定义单条类型', NULL, NULL,
     NULL, NULL, NULL, 1, 60),
    (100005, 'type100005', 1, 1, 'reference-data', 'custom-batch', 'PANEL_MENU', '自定义批量类型', NULL, NULL,
     NULL, NULL, NULL, 1, 50),
    (100006, 'empty100006', 1, 1, 'empty', 'without-children', 'CONTEXT_MENU', '无子数据类型', NULL, NULL,
     NULL, NULL, NULL, 1, 40);
INSERT INTO ReferenceDataTreeNode (
    id, code, tenantId, lastOperateUserId, typeId, parentId, nodeCode, nodeValue, labelZh, status, sortnum
) VALUES (100010, 'treeNode100010', 1, 1, 100001, NULL, 'root', 'ROOT', '根节点', 1, 1);
