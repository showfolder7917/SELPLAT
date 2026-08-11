-- ReferenceDataContextMenuItem 只保存某个引用数据类型下的右键菜单，并通过 parentId 组织子菜单。
CREATE TABLE IF NOT EXISTS ReferenceDataContextMenuItem (
    id BIGINT PRIMARY KEY,
    typeId BIGINT NOT NULL,
    parentId BIGINT,
    itemCode VARCHAR(100) NOT NULL,
    labelZh VARCHAR(200) NOT NULL,
    labelJa VARCHAR(200),
    labelEn VARCHAR(200),
    icon VARCHAR(100),
    command VARCHAR(120),
    attributesJson CLOB,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reference_data_context_menu_type FOREIGN KEY (typeId) REFERENCES ReferenceDataType(id),
    CONSTRAINT fk_reference_data_context_menu_parent FOREIGN KEY (parentId) REFERENCES ReferenceDataContextMenuItem(id),
    CONSTRAINT uk_reference_data_context_menu_code UNIQUE (typeId, itemCode),
    CONSTRAINT ck_reference_data_context_menu_status CHECK (status IN (0, 1, 2))
);

-- 管理接口需要在数据库连接关闭后序列化扩展属性；统一使用足够大的 VARCHAR，避免驱动返回已关闭的 JdbcClob。
ALTER TABLE IF EXISTS ReferenceDataContextMenuItem ALTER COLUMN attributesJson VARCHAR(10000);

COMMENT ON TABLE ReferenceDataContextMenuItem IS '引用数据右键菜单项表';
COMMENT ON COLUMN ReferenceDataContextMenuItem.parentId IS '父菜单项主键，顶级菜单为空';
COMMENT ON COLUMN ReferenceDataContextMenuItem.command IS '叶子菜单触发的稳定业务命令';

CREATE INDEX IF NOT EXISTS idx_reference_data_context_menu_type_status_sort
    ON ReferenceDataContextMenuItem(typeId, status, sortnum, id);
