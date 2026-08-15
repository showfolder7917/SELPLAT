SET REFERENTIAL_INTEGRITY FALSE;
DELETE FROM ReferenceDataControlLayout;
DELETE FROM ReferenceDataWindow;
DELETE FROM ReferenceDataTableElement;
DELETE FROM ReferenceDataTreeNode;
DELETE FROM ReferenceDataTable;
DELETE FROM ReferenceDataType;
DELETE FROM CommonSequenceSegment;
SET REFERENTIAL_INTEGRITY TRUE;
INSERT INTO ReferenceDataType (
    id, code, tenantId, lastOperateUserId, projectCode, resourceCode, type, nameZh, status, sortnum
) VALUES
    (100001, 'type100001', 1, 1, 'reference-data', 'resource-kind', 'TREE', '引用数据资源类型', 1, 100),
    (100002, 'cms100002', 1, 1, 'cms', 'article-category', 'DROPDOWN', '文章分类', 1, 80);
