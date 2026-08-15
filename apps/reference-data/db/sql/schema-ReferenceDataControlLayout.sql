-- ReferenceDataControlLayout 保存页面可编辑控件及其响应式布局。
CREATE TABLE IF NOT EXISTS ReferenceDataControlLayout (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    projectCode VARCHAR(64) NOT NULL,
    pageCode VARCHAR(100) NOT NULL,
    -- parentKind 明确父坐标属于页面、Window 还是页面内容器，禁止根据 code 字符串前缀猜测关联类型。
    parentKind VARCHAR(32),
    -- parentCode 保存父容器的稳定 code；PAGE 根记录为空，普通页面直属控件等于当前 pageCode。
    parentCode VARCHAR(100),
    controlKind VARCHAR(32) NOT NULL,
    typeId BIGINT,
    tableId BIGINT,
    sourceTableName VARCHAR(100) NOT NULL DEFAULT 'ReferenceDataControlLayout',
    layoutMode VARCHAR(16) NOT NULL DEFAULT 'FLOW',
    orderNo INTEGER NOT NULL DEFAULT 0,
    width VARCHAR(32), height VARCHAR(32),
    minWidth VARCHAR(32), maxWidth VARCHAR(32),
    minHeight VARCHAR(32), maxHeight VARCHAR(32),
    gapBefore VARCHAR(32), gapAfter VARCHAR(32),
    gridColumnSpan INTEGER,
    wrap BOOLEAN NOT NULL DEFAULT TRUE,
    x INTEGER, y INTEGER,
    breakpoint VARCHAR(16) NOT NULL DEFAULT 'DESKTOP',
    editable BOOLEAN NOT NULL DEFAULT TRUE,
    versionNo BIGINT NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reference_data_control_layout_code UNIQUE (code),
    CONSTRAINT fk_reference_data_control_layout_type FOREIGN KEY (typeId) REFERENCES ReferenceDataType(id),
    CONSTRAINT fk_reference_data_control_layout_table FOREIGN KEY (tableId) REFERENCES ReferenceDataTable(id),
    CONSTRAINT ck_reference_data_control_layout_parent_kind
        CHECK (parentKind IS NULL OR parentKind IN ('PAGE', 'WINDOW', 'PANEL', 'TOOLBAR', 'CONTROL')),
    CONSTRAINT ck_reference_data_control_layout_mode CHECK (layoutMode IN ('FLOW', 'GRID', 'ABSOLUTE')),
    CONSTRAINT ck_reference_data_control_layout_status CHECK (status IN (0, 1, 2))
);
ALTER TABLE ReferenceDataControlLayout ADD COLUMN IF NOT EXISTS parentKind VARCHAR(32);
ALTER TABLE ReferenceDataControlLayout ADD CONSTRAINT IF NOT EXISTS ck_reference_data_control_layout_parent_kind
    CHECK (parentKind IS NULL OR parentKind IN ('PAGE', 'WINDOW', 'PANEL', 'TOOLBAR', 'CONTROL'));
COMMENT ON TABLE ReferenceDataControlLayout IS '页面可编辑控件与响应式布局配置表';
COMMENT ON COLUMN ReferenceDataControlLayout.parentKind IS '父容器类别：PAGE、WINDOW、PANEL、TOOLBAR或CONTROL；页面根为空';
COMMENT ON COLUMN ReferenceDataControlLayout.parentCode IS '父容器稳定code；与parentKind共同形成明确所属位置';
CREATE INDEX IF NOT EXISTS idx_reference_data_control_layout_page
    ON ReferenceDataControlLayout(tenantId, pageCode, status, orderNo, id);
