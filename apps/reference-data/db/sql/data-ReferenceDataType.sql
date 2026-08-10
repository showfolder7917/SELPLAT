-- 初始化 reference-data 自身的资源类型目录，使管理页面首次启动即可看到平台内置类型。
-- 稳定坐标为 reference-data/resource-kind；脚本只在该坐标不存在时插入，重启不会覆盖后台修改后的名称、状态或排序。
INSERT INTO ReferenceDataType (
    id,
    projectCode,
    resourceCode,
    nameZh,
    nameJa,
    nameEn,
    descriptionZh,
    descriptionJa,
    descriptionEn,
    status,
    sortnum
) SELECT
    900000000001,
    -- projectCode 与 resourceCode 构成跨重启、跨语言都不变化的业务坐标。
    'reference-data',
    'resource-kind',
    -- 三语名称与说明只负责类型展示，不参与程序逻辑判断。
    '引用数据资源类型',
    '参照データリソース種別',
    'Reference data resource types',
    '描述平台内置的引用数据资源类型。',
    'プラットフォーム組み込みの参照データリソース種別を管理します。',
    'Describes built-in reference-data resource types.',
    -- 内置目录默认启用并使用 100 作为初始业务顺序。
    1,
    100
WHERE NOT EXISTS (
    -- 仅按稳定坐标判断是否已初始化，避免用户修改展示字段后被种子脚本重复插入或覆盖。
    SELECT 1
    FROM ReferenceDataType
    WHERE projectCode = 'reference-data'
      AND resourceCode = 'resource-kind'
);

-- Japanese 题库通过 reference-data 的真实表登记题型树，不依赖应用私有模型或无表查询层。
INSERT INTO ReferenceDataType (
    id, projectCode, resourceCode, nameZh, nameJa, nameEn,
    descriptionZh, descriptionJa, descriptionEn, status, sortnum
) SELECT
    900000000002, 'japanese', 'n2-blue-book-question',
    'N2 蓝宝书1000题', 'N2 ブルーブック1000問', 'N2 Blue Book 1000 Questions',
    '登记 N2 蓝宝书题库的读音、汉字和语法分类树。',
    'N2ブルーブック問題集の読み方・漢字・文法分類ツリー。',
    'Registers the reading, kanji, and grammar category tree.',
    1, 90
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataType
    WHERE projectCode = 'japanese' AND resourceCode = 'n2-blue-book-question'
);
