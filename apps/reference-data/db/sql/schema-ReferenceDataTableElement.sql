-- ReferenceDataTableElement 统一保存表格列、工具栏动作和行操作。
CREATE TABLE IF NOT EXISTS ReferenceDataTableElement (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    projectCode VARCHAR(64) NOT NULL,
    tableId BIGINT NOT NULL,
    elementType VARCHAR(32) NOT NULL DEFAULT 'COLUMN',
    fieldName VARCHAR(100),
    secondaryFieldName VARCHAR(100),
    labelZh VARCHAR(200) NOT NULL,
    labelJa VARCHAR(200),
    labelEn VARCHAR(200),
    width VARCHAR(32) NOT NULL DEFAULT 'auto',
    minWidth VARCHAR(32),
    maxWidth VARCHAR(32),
    cellRenderer VARCHAR(32) NOT NULL DEFAULT 'text',
    icon VARCHAR(100),
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    resizable BOOLEAN NOT NULL DEFAULT TRUE,
    attributesJson VARCHAR(10000),
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reference_data_table_element_code UNIQUE (code),
    CONSTRAINT fk_reference_data_table_element_table FOREIGN KEY (tableId) REFERENCES ReferenceDataTable(id),
    CONSTRAINT ck_reference_data_table_element_type CHECK (elementType IN ('COLUMN', 'TOOLBAR_ACTION', 'ROW_ACTION')),
    CONSTRAINT ck_reference_data_table_element_status CHECK (status IN (0, 1, 2))
);
COMMENT ON TABLE ReferenceDataTableElement IS 'SEL表格列、工具栏动作和行操作统一配置表';
CREATE INDEX IF NOT EXISTS idx_reference_data_table_element_table
    ON ReferenceDataTableElement(tableId, status, visible, sortnum, id);
