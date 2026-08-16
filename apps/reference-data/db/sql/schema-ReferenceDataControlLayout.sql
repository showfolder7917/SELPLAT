-- ReferenceDataControlLayout 保存页面可编辑控件及其响应式布局。
CREATE TABLE IF NOT EXISTS ReferenceDataControlLayout (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    projectCode VARCHAR(64) NOT NULL,
    pageCode VARCHAR(100) NOT NULL,
    -- parentKind 明确父坐标属于页面或页面内容器；Window 外框只由 ReferenceDataWindow 保存。
    parentKind VARCHAR(32),
    -- parentCode 保存父容器的稳定 code；PAGE 根记录为空，普通页面直属控件等于当前 pageCode。
    parentCode VARCHAR(100),
    controlKind VARCHAR(32) NOT NULL,
    -- fieldName 是页面控件或动作的稳定语义名；页面级布局控件可为空。
    fieldName VARCHAR(100),
    -- optionSetCode 绑定可复用的选项组；没有下拉或菜单选项的控件保持为空。
    optionSetCode VARCHAR(100),
    tableId BIGINT,
    sourceTableName VARCHAR(100) NOT NULL DEFAULT 'ReferenceDataControlLayout',
    layoutMode VARCHAR(16) NOT NULL DEFAULT 'FLOW',
    orderNo INTEGER NOT NULL DEFAULT 0,
    width VARCHAR(32), height VARCHAR(32),
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
    CONSTRAINT uk_reference_data_control_layout_parent_field
        UNIQUE (tenantId, parentKind, parentCode, fieldName),
    CONSTRAINT fk_reference_data_control_layout_table FOREIGN KEY (tableId) REFERENCES ReferenceDataTable(id),
    CONSTRAINT ck_reference_data_control_layout_parent_kind
        CHECK (parentKind IS NULL OR parentKind IN ('PAGE', 'PANEL', 'TOOLBAR', 'CONTROL')),
    CONSTRAINT ck_reference_data_control_layout_mode CHECK (layoutMode IN ('FLOW', 'GRID', 'ABSOLUTE')),
    CONSTRAINT ck_reference_data_control_layout_status CHECK (status IN (0, 1, 2))
);
ALTER TABLE ReferenceDataControlLayout ADD COLUMN IF NOT EXISTS parentKind VARCHAR(32);
ALTER TABLE ReferenceDataControlLayout ADD COLUMN IF NOT EXISTS fieldName VARCHAR(100);
ALTER TABLE ReferenceDataControlLayout ADD COLUMN IF NOT EXISTS optionSetCode VARCHAR(100);
ALTER TABLE ReferenceDataControlLayout ADD CONSTRAINT IF NOT EXISTS uk_reference_data_control_layout_parent_field
    UNIQUE (tenantId, parentKind, parentCode, fieldName);
-- 控件通过 optionSetCode 使用可复用选项组，旧 typeId 反向关系不再保留。
ALTER TABLE ReferenceDataControlLayout DROP CONSTRAINT IF EXISTS fk_reference_data_control_layout_type;
ALTER TABLE ReferenceDataControlLayout DROP COLUMN IF EXISTS typeId;
-- 旧库可能仍有 WINDOW 子记录；schema 只负责兼容加载，事务迁移会物理删除后再收紧最终约束。
ALTER TABLE ReferenceDataControlLayout DROP CONSTRAINT IF EXISTS ck_reference_data_control_layout_parent_kind;
ALTER TABLE ReferenceDataControlLayout ADD CONSTRAINT IF NOT EXISTS ck_reference_data_control_layout_parent_kind
    CHECK (parentKind IS NULL OR parentKind IN ('PAGE', 'WINDOW', 'PANEL', 'TOOLBAR', 'CONTROL'));
-- 页面编辑只保存实际矩形；旧约束与间距列没有运行时读取链，已有库启动时幂等清理。
ALTER TABLE ReferenceDataControlLayout DROP COLUMN IF EXISTS minWidth;
ALTER TABLE ReferenceDataControlLayout DROP COLUMN IF EXISTS maxWidth;
ALTER TABLE ReferenceDataControlLayout DROP COLUMN IF EXISTS minHeight;
ALTER TABLE ReferenceDataControlLayout DROP COLUMN IF EXISTS maxHeight;
ALTER TABLE ReferenceDataControlLayout DROP COLUMN IF EXISTS gapBefore;
ALTER TABLE ReferenceDataControlLayout DROP COLUMN IF EXISTS gapAfter;
ALTER TABLE ReferenceDataControlLayout DROP COLUMN IF EXISTS gridColumnSpan;
COMMENT ON TABLE ReferenceDataControlLayout IS '页面可编辑控件与响应式布局配置表';
COMMENT ON COLUMN ReferenceDataControlLayout.parentKind IS '父容器类别：PAGE、PANEL、TOOLBAR或CONTROL；页面根为空';
COMMENT ON COLUMN ReferenceDataControlLayout.parentCode IS '父容器稳定code；与parentKind共同形成明确所属位置';
COMMENT ON COLUMN ReferenceDataControlLayout.fieldName IS '页面控件的稳定字段或动作名称；普通布局控件可为空';
COMMENT ON COLUMN ReferenceDataControlLayout.optionSetCode IS '控件使用的共享选项组code；无选项时为空';
CREATE INDEX IF NOT EXISTS idx_reference_data_control_layout_page
    ON ReferenceDataControlLayout(tenantId, pageCode, status, orderNo, id);
CREATE INDEX IF NOT EXISTS idx_reference_data_control_layout_option_set
    ON ReferenceDataControlLayout(tenantId, optionSetCode, status, id);
