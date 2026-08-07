INSERT INTO ReferenceDataType (
    projectCode,
    resourceCode,
    nameZh,
    nameJa,
    nameEn,
    descriptionZh,
    descriptionJa,
    descriptionEn,
    dataShape,
    status,
    sortnum
) SELECT
    'reference-data',
    'resource-kind',
    '引用数据资源类型',
    '参照データリソース種別',
    'Reference data resource types',
    '描述平台支持的树形资源和选项资源。',
    'ツリーと選択肢の参照データ種別を管理します。',
    'Describes tree and option reference-data resources.',
    'BOTH',
    1,
    100
WHERE NOT EXISTS (
    SELECT 1
    FROM ReferenceDataType
    WHERE projectCode = 'reference-data'
      AND resourceCode = 'resource-kind'
);
