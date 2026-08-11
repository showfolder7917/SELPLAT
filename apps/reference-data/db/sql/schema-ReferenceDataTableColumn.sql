-- ReferenceDataTableColumn 以一条记录描述一个页面表格列，是管理页表头的唯一数据库配置来源。
CREATE TABLE IF NOT EXISTS ReferenceDataTableColumn (
    id BIGINT PRIMARY KEY,
    tableCode VARCHAR(100) NOT NULL,
    viewCode VARCHAR(100) NOT NULL,
    columnCode VARCHAR(100) NOT NULL,
    fieldCode VARCHAR(100) NOT NULL,
    secondaryField VARCHAR(100),
    labelZh VARCHAR(200) NOT NULL,
    labelJa VARCHAR(200),
    labelEn VARCHAR(200),
    width VARCHAR(32) NOT NULL DEFAULT 'auto',
    renderer VARCHAR(32) NOT NULL DEFAULT 'text',
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reference_data_table_column UNIQUE (tableCode, viewCode, columnCode),
    CONSTRAINT ck_reference_data_table_column_status CHECK (status IN (0, 1, 2)),
    CONSTRAINT ck_reference_data_table_column_renderer CHECK (
        renderer IN ('text', 'stack', 'badge', 'time', 'boolean', 'actions'))
);

COMMENT ON TABLE ReferenceDataTableColumn IS '页面表格头和字段列配置表';
COMMENT ON COLUMN ReferenceDataTableColumn.tableCode IS '配置对应的真实数据库表名';
COMMENT ON COLUMN ReferenceDataTableColumn.viewCode IS '同一数据库表在页面中的稳定表格实例编码';
COMMENT ON COLUMN ReferenceDataTableColumn.columnCode IS '表格实例内部唯一的列编码';
COMMENT ON COLUMN ReferenceDataTableColumn.fieldCode IS '记录中实际显示的字段编码';
COMMENT ON COLUMN ReferenceDataTableColumn.secondaryField IS 'stack渲染器使用的第二显示字段';
COMMENT ON COLUMN ReferenceDataTableColumn.labelZh IS '表头中文名称';
COMMENT ON COLUMN ReferenceDataTableColumn.labelJa IS '表头日文名称';
COMMENT ON COLUMN ReferenceDataTableColumn.labelEn IS '表头英文名称';
COMMENT ON COLUMN ReferenceDataTableColumn.width IS '列宽，可使用百分比或像素值';
COMMENT ON COLUMN ReferenceDataTableColumn.renderer IS '公共selGrid渲染方式';
COMMENT ON COLUMN ReferenceDataTableColumn.visible IS '当前页面是否显示该列';
COMMENT ON COLUMN ReferenceDataTableColumn.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN ReferenceDataTableColumn.sortnum IS '表头从左到右的稳定顺序';

CREATE INDEX IF NOT EXISTS idx_reference_data_table_column_view_status_sort
    ON ReferenceDataTableColumn(tableCode, viewCode, status, visible, sortnum, id);
