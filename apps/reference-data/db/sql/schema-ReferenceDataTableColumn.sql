-- ReferenceDataTableColumn 以一条记录描述一个页面表格列，是管理页表头的唯一数据库配置来源。
CREATE TABLE IF NOT EXISTS ReferenceDataTableColumn (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    tableName VARCHAR(100) NOT NULL,
    gridId VARCHAR(100) NOT NULL,
    gridColumnId VARCHAR(100) NOT NULL,
    tableFieldName VARCHAR(100) NOT NULL,
    tableSecondaryFieldName VARCHAR(100),
    labelZh VARCHAR(200) NOT NULL,
    labelJa VARCHAR(200),
    labelEn VARCHAR(200),
    width VARCHAR(32) NOT NULL DEFAULT 'auto',
    cellRenderer VARCHAR(32) NOT NULL DEFAULT 'text',
    cellIcon VARCHAR(100),
    cellIconVisible BOOLEAN NOT NULL DEFAULT FALSE,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reference_data_table_column UNIQUE (tableName, gridId, gridColumnId),
    CONSTRAINT ck_reference_data_table_column_status CHECK (status IN (0, 1, 2)),
    CONSTRAINT ck_reference_data_table_column_renderer CHECK (
        cellRenderer IN ('text', 'stack', 'badge', 'time', 'boolean', 'actions'))
);

COMMENT ON TABLE ReferenceDataTableColumn IS '页面表格头和字段列配置表';
COMMENT ON COLUMN ReferenceDataTableColumn.tenantId IS '数据所属租户标识';
COMMENT ON COLUMN ReferenceDataTableColumn.lastOperateUserId IS '最近维护数据的操作员标识';
COMMENT ON COLUMN ReferenceDataTableColumn.tableName IS '配置对应的真实数据库表名';
COMMENT ON COLUMN ReferenceDataTableColumn.gridId IS '页面中的SEL表格实例标识';
COMMENT ON COLUMN ReferenceDataTableColumn.gridColumnId IS '表格实例内部唯一的列标识';
COMMENT ON COLUMN ReferenceDataTableColumn.tableFieldName IS '单元格读取的真实数据库字段名';
COMMENT ON COLUMN ReferenceDataTableColumn.tableSecondaryFieldName IS 'stack渲染器读取的第二数据库字段名';
COMMENT ON COLUMN ReferenceDataTableColumn.labelZh IS '表头中文名称';
COMMENT ON COLUMN ReferenceDataTableColumn.labelJa IS '表头日文名称';
COMMENT ON COLUMN ReferenceDataTableColumn.labelEn IS '表头英文名称';
COMMENT ON COLUMN ReferenceDataTableColumn.width IS '列宽，可使用百分比或像素值';
COMMENT ON COLUMN ReferenceDataTableColumn.cellRenderer IS '公共selGrid单元格渲染方式';
COMMENT ON COLUMN ReferenceDataTableColumn.cellIcon IS '单元格显示的图标类名';
COMMENT ON COLUMN ReferenceDataTableColumn.cellIconVisible IS '单元格是否显示配置图标';
COMMENT ON COLUMN ReferenceDataTableColumn.visible IS '当前页面是否显示该列';
COMMENT ON COLUMN ReferenceDataTableColumn.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN ReferenceDataTableColumn.sortnum IS '表头从左到右的稳定顺序';

CREATE INDEX IF NOT EXISTS idx_reference_data_table_column_view_status_sort
    ON ReferenceDataTableColumn(tableName, gridId, status, visible, sortnum, id);
