-- ReferenceDataTable 以一条记录登记一个项目页面中的 SEL 表格，并作为表格列配置的查看入口。
CREATE TABLE IF NOT EXISTS ReferenceDataTable (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    projectName VARCHAR(100) NOT NULL,
    tableName VARCHAR(100) NOT NULL,
    gridColumnId VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    pagePath VARCHAR(500),
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reference_data_table_grid UNIQUE (projectName, gridColumnId),
    CONSTRAINT ck_reference_data_table_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE ReferenceDataTable IS '项目页面表格登记与表格头明细入口表';
COMMENT ON COLUMN ReferenceDataTable.id IS '表格登记主键，由reference-data独立数据库生成';
COMMENT ON COLUMN ReferenceDataTable.tenantId IS '数据所属租户标识';
COMMENT ON COLUMN ReferenceDataTable.lastOperateUserId IS '最近维护数据的操作员标识';
COMMENT ON COLUMN ReferenceDataTable.projectName IS '表格所在项目的稳定名称';
COMMENT ON COLUMN ReferenceDataTable.tableName IS '表格展示数据对应的真实数据库表名';
COMMENT ON COLUMN ReferenceDataTable.gridColumnId IS '页面中的SEL表格配置标识，用于定位该表格的全部列';
COMMENT ON COLUMN ReferenceDataTable.description IS '表格用途和展示内容说明';
COMMENT ON COLUMN ReferenceDataTable.pagePath IS '表格所在页面的工程内路径或访问路径';
COMMENT ON COLUMN ReferenceDataTable.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN ReferenceDataTable.sortnum IS '表格登记的业务排序值';
COMMENT ON COLUMN ReferenceDataTable.createdAt IS '数据创建时间';
COMMENT ON COLUMN ReferenceDataTable.updatedAt IS '数据最后更新时间';

CREATE INDEX IF NOT EXISTS idx_reference_data_table_project_status_sort
    ON ReferenceDataTable(projectName, status, sortnum, id);
