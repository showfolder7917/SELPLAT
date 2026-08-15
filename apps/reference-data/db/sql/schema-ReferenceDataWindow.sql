-- ReferenceDataWindow 保存 SEL Window 的默认几何状态和行为边界。
CREATE TABLE IF NOT EXISTS ReferenceDataWindow (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    projectCode VARCHAR(64) NOT NULL,
    pageCode VARCHAR(100) NOT NULL,
    triggerControlCode VARCHAR(100),
    nameZh VARCHAR(200) NOT NULL,
    nameJa VARCHAR(200), nameEn VARCHAR(200),
    width VARCHAR(32) NOT NULL, height VARCHAR(32) NOT NULL,
    minWidth VARCHAR(32), minHeight VARCHAR(32),
    maxWidth VARCHAR(32), maxHeight VARCHAR(32),
    x INTEGER, y INTEGER,
    positionMode VARCHAR(16) NOT NULL DEFAULT 'CENTER',
    resizable BOOLEAN NOT NULL DEFAULT TRUE,
    draggable BOOLEAN NOT NULL DEFAULT TRUE,
    maximizable BOOLEAN NOT NULL DEFAULT TRUE,
    minimizable BOOLEAN NOT NULL DEFAULT TRUE,
    breakpoint VARCHAR(16) NOT NULL DEFAULT 'DESKTOP',
    versionNo BIGINT NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reference_data_window_code UNIQUE (code),
    CONSTRAINT ck_reference_data_window_position CHECK (positionMode IN ('CENTER', 'CUSTOM')),
    CONSTRAINT ck_reference_data_window_status CHECK (status IN (0, 1, 2))
);
-- 页面编辑采用控件级显式保存；旧库中的 rememberLastState 已无业务语义，兼容升级时直接移除。
ALTER TABLE ReferenceDataWindow DROP COLUMN IF EXISTS rememberLastState;
COMMENT ON TABLE ReferenceDataWindow IS 'SEL Window默认尺寸、位置和行为配置表';
CREATE INDEX IF NOT EXISTS idx_reference_data_window_page
    ON ReferenceDataWindow(tenantId, pageCode, status, sortnum, id);
