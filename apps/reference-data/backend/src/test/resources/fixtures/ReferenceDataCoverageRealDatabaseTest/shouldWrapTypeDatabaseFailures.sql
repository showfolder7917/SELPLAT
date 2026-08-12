-- ReferenceDataCoverageRealDatabaseTest.shouldWrapTypeDatabaseFailures Case
SET REFERENTIAL_INTEGRITY FALSE;
DELETE FROM ReferenceDataContextMenuItem;
DELETE FROM ReferenceDataOption;
DELETE FROM ReferenceDataTreeNode;
DELETE FROM ReferenceDataTableColumn;
DELETE FROM ReferenceDataTable;
DELETE FROM ReferenceDataType;
DELETE FROM CommonSequenceSegment;
SET REFERENTIAL_INTEGRITY TRUE;
INSERT INTO ReferenceDataType (
    id, tenantId, lastOperateUserId, projectCode, resourceCode, nameZh, status, sortnum
) VALUES
    (100001, 1, 1, 'reference-data', 'resource-kind', '引用数据资源类型', 1, 100),
    (100002, 1, 1, 'cms', 'article-category', '文章分类', 1, 80);
