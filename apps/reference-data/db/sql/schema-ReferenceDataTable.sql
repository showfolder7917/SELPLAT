-- ReferenceDataTable 一条记录代表页面中的一个 SEL Grid，公开查询只使用 code。
CREATE TABLE IF NOT EXISTS ReferenceDataTable (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    projectCode VARCHAR(64) NOT NULL,
    pageCode VARCHAR(100) NOT NULL,
    dataTableName VARCHAR(100) NOT NULL,
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
    CONSTRAINT ck_reference_data_table_selection CHECK (selectionMode IN ('NONE', 'SINGLE', 'MULTIPLE')),
    CONSTRAINT ck_reference_data_table_status CHECK (status IN (0, 1, 2))
);
COMMENT ON TABLE ReferenceDataTable IS '页面SEL Grid定义表';
CREATE INDEX IF NOT EXISTS idx_reference_data_table_page
    ON ReferenceDataTable(tenantId, pageCode, status, sortnum, id);
