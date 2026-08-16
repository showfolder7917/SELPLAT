CREATE TABLE ReferenceDataTable (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
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
    sortnum DECIMAL(18,2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ReferenceDataTableElement (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
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
    sortnum DECIMAL(18,2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_legacy_element_table FOREIGN KEY (tableId) REFERENCES ReferenceDataTable(id)
);

INSERT INTO ReferenceDataTable(id,code,projectCode,pageCode,dataTableName,nameZh,sortnum) VALUES
    (101018,'table101018','reference-data','page101017','ReferenceDataType','数据类型',10),
    (101019,'table101019','reference-data','page101017','ReferenceDataTreeNode','树节点',20),
    (101020,'table101020','reference-data','page101017','ReferenceDataTable','表格定义',30),
    (101021,'table101021','reference-data','page101017','ReferenceDataTableElement','表格元素',40),
    (101022,'table101022','reference-data','page101017','ReferenceDataControlLayout','页面控件',50),
    (101023,'table101023','reference-data','page101017','ReferenceDataWindow','Window',60);

INSERT INTO ReferenceDataTableElement(id,code,projectCode,tableId,fieldName,labelZh,sortnum) VALUES
    (101101,'tableElement101101','reference-data',101018,'categoryCode','分类编码',10),
    (101102,'tableElement101102','reference-data',101019,'nodeValue','节点值',10),
    (101103,'tableElement101103','reference-data',101020,'gridId','Grid实例',10),
    (101104,'tableElement101104','reference-data',101021,'viewCode','业务视图',10),
    (101105,'tableElement101105','reference-data',101022,'controlKind','控件类型',10),
    (101106,'tableElement101106','reference-data',101023,'positionMode','定位模式',10);
