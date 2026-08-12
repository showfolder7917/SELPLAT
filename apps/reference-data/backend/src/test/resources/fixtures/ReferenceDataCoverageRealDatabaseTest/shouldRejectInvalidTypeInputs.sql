-- ReferenceDataCoverageRealDatabaseTest.shouldRejectInvalidTypeInputs Case
SET REFERENTIAL_INTEGRITY FALSE;
DELETE FROM ReferenceDataContextMenuItem;
DELETE FROM ReferenceDataOption;
DELETE FROM ReferenceDataTreeNode;
DELETE FROM ReferenceDataTableColumn;
DELETE FROM ReferenceDataTable;
DELETE FROM ReferenceDataType;
DELETE FROM CommonSequenceSegment;
SET REFERENTIAL_INTEGRITY TRUE;
INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, status
) VALUES (1, 1, 'ReferenceDataTypeId', '类型主键', 101000, 100, 0, 1);
INSERT INTO ReferenceDataType (
    id, tenantId, lastOperateUserId, projectCode, resourceCode, nameZh, nameJa, nameEn,
    descriptionZh, descriptionJa, descriptionEn, status, sortnum
) VALUES
    (100001, 1, 1, 'reference-data', 'resource-kind', '引用数据资源类型', '参照データ種別', 'Reference data types',
     '平台内置类型', 'プラットフォーム組み込み種別', 'Built-in type', 1, 100),
    (100002, 1, 1, 'cms', 'article-category', '文章分类', '記事カテゴリ', 'Article categories',
     '文章分类说明', '記事カテゴリ説明', 'Article category description', 1, 80),
    (100003, 1, 1, 'cms', 'archive-category', '归档分类', 'アーカイブカテゴリ', 'Archive categories',
     '归档分类说明', 'アーカイブカテゴリ説明', 'Archive category description', 2, 70),
    (100004, 1, 1, 'reference-data', 'custom-single', '自定义单条类型', NULL, NULL,
     NULL, NULL, NULL, 1, 60),
    (100005, 1, 1, 'reference-data', 'custom-batch', '自定义批量类型', NULL, NULL,
     NULL, NULL, NULL, 1, 50),
    (100006, 1, 1, 'empty', 'without-children', '无子数据类型', NULL, NULL,
     NULL, NULL, NULL, 1, 40);
