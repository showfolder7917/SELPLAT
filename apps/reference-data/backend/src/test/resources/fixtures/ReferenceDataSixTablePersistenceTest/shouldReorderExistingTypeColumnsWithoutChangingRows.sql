-- ReferenceDataSixTablePersistenceTest.shouldReorderExistingTypeColumnsWithoutChangingRows Case
-- 旧文件库把后补的 code 与 categoryCode 放在时间字段之后，用于验证原地顺序迁移和数据保留。
CREATE TABLE ReferenceDataType (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    nameZh VARCHAR(120) NOT NULL,
    nameJa VARCHAR(120),
    nameEn VARCHAR(120),
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    code VARCHAR(100) NOT NULL,
    categoryCode VARCHAR(32) NOT NULL,
    CONSTRAINT uk_reference_data_type_code UNIQUE (code),
    CONSTRAINT uk_reference_data_type_category_code UNIQUE (categoryCode),
    CONSTRAINT ck_reference_data_type_category_code CHECK (
        categoryCode IN ('DROPDOWN', 'TREE', 'GRID_MENU', 'PANEL_MENU', 'CONTEXT_MENU')),
    CONSTRAINT ck_reference_data_type_status CHECK (status IN (0, 1, 2))
);

INSERT INTO ReferenceDataType (
    id, tenantId, lastOperateUserId, nameZh, nameJa, nameEn,
    status, sortnum, code, categoryCode
) VALUES
(
    101000, 1, 1, '树', 'ツリー', 'Tree',
    1, 100, 'type101000', 'TREE'
),
(
    101002, 1, 1, '下拉框', 'ドロップダウン', 'Dropdown',
    1, 110, 'type101002', 'DROPDOWN'
);

-- 旧全局分类需要唯一绑定到当前页面的类型筛选控件，迁移不得猜测其他控件。
CREATE TABLE ReferenceDataControlLayout (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    tenantId BIGINT NOT NULL DEFAULT 1,
    projectCode VARCHAR(64) NOT NULL,
    pageCode VARCHAR(100) NOT NULL,
    parentCode VARCHAR(100),
    controlKind VARCHAR(32) NOT NULL,
    orderNo INTEGER NOT NULL,
    status INTEGER NOT NULL DEFAULT 1
);

INSERT INTO ReferenceDataControlLayout (
    id, code, tenantId, projectCode, pageCode, parentCode, controlKind, orderNo, status
) VALUES (
    101001, 'control101001', 1, 'reference-data', 'page101000', 'page101000', 'FILTER', 30, 1
);
