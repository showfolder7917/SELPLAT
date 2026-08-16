-- ReferenceDataTable 一条记录只代表页面中的一个真实 SEL Grid，模块视图由子元素 viewCode 区分。
CREATE TABLE IF NOT EXISTS ReferenceDataTable (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    projectCode VARCHAR(64) NOT NULL,
    pageCode VARCHAR(100) NOT NULL,
    sourceTableName VARCHAR(100) NOT NULL DEFAULT 'ReferenceDataTable',
    gridId VARCHAR(100) NOT NULL,
    nameZh VARCHAR(200) NOT NULL,
    nameJa VARCHAR(200),
    nameEn VARCHAR(200),
    description VARCHAR(500),
    selectionMode VARCHAR(16) NOT NULL DEFAULT 'NONE',
    pageSize INTEGER NOT NULL DEFAULT 20,
    rowHeight INTEGER NOT NULL DEFAULT 48,
    attributesJson VARCHAR(10000),
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reference_data_table_code UNIQUE (code),
    CONSTRAINT uk_reference_data_table_page_grid UNIQUE (tenantId, pageCode, gridId),
    CONSTRAINT ck_reference_data_table_selection CHECK (selectionMode IN ('NONE', 'SINGLE', 'MULTIPLE')),
    CONSTRAINT ck_reference_data_table_status CHECK (status IN (0, 1, 2))
);
ALTER TABLE ReferenceDataTable ADD COLUMN IF NOT EXISTS gridId VARCHAR(100);
ALTER TABLE ReferenceDataTable ADD COLUMN IF NOT EXISTS sourceTableName VARCHAR(100)
    DEFAULT 'ReferenceDataTable';
COMMENT ON TABLE ReferenceDataTable IS '页面真实SEL Grid定义表';
COMMENT ON COLUMN ReferenceDataTable.sourceTableName IS '该Grid实际读取的业务表名；用于公共表头配置校验';
COMMENT ON COLUMN ReferenceDataTable.gridId IS '页面真实Grid实例ID；同一物理控件切换模块时保持不变';
CREATE INDEX IF NOT EXISTS idx_reference_data_table_page
    ON ReferenceDataTable(tenantId, pageCode, status, sortnum, id);
CREATE INDEX IF NOT EXISTS idx_reference_data_table_source
    ON ReferenceDataTable(tenantId, sourceTableName, status, id);
