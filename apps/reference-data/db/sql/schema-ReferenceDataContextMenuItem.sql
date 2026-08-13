-- ReferenceDataContextMenuItem 只保存某个引用数据类型下的右键菜单，并通过 parentId 组织子菜单。
CREATE TABLE IF NOT EXISTS ReferenceDataContextMenuItem (
    -- id 作为菜单项主键，由当前 reference-data 独立数据库生成。
    id BIGINT PRIMARY KEY,
    -- tenantId 标识当前菜单项所属租户。
    tenantId BIGINT NOT NULL DEFAULT 1,
    -- lastOperateUserId 记录最近维护该菜单项的操作员。
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    -- typeId 关联所属 ReferenceDataType，所有菜单项必须归属于一个明确类型。
    typeId BIGINT NOT NULL,
    -- parentId 关联同表父菜单项；顶级菜单保持为空。
    parentId BIGINT,
    -- itemCode 保存类型内部稳定的菜单项编码，与 typeId 共同保证唯一。
    itemCode VARCHAR(100) NOT NULL,
    -- labelZh 保存菜单项中文显示文本。
    labelZh VARCHAR(200) NOT NULL,
    -- labelJa 保存菜单项日文显示文本；未配置时由上层国际化回退策略处理。
    labelJa VARCHAR(200),
    -- labelEn 保存菜单项英文显示文本；未配置时由上层国际化回退策略处理。
    labelEn VARCHAR(200),
    -- icon 保存公共图标库类名，未配置时由菜单控件使用默认表现。
    icon VARCHAR(100),
    -- command 保存叶子菜单触发的稳定业务命令，分组菜单可以为空。
    command VARCHAR(120),
    -- attributesJson 保存菜单项业务扩展属性 JSON，不承载固定平台字段。
    attributesJson VARCHAR(10000),
    -- disabled 标识菜单项是否展示但禁止操作，与记录生命周期状态相互独立。
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- status 保存逻辑状态：0 表示逻辑删除，1 表示启用，2 表示停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存同类型或同父菜单下的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存菜单项首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存菜单项最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 类型外键保证菜单项不会脱离类型目录独立存在。
    CONSTRAINT fk_reference_data_context_menu_type FOREIGN KEY (typeId) REFERENCES ReferenceDataType(id),
    -- 父菜单外键保证层级关系只能引用当前菜单表中的真实记录。
    CONSTRAINT fk_reference_data_context_menu_parent FOREIGN KEY (parentId) REFERENCES ReferenceDataContextMenuItem(id),
    -- 同一类型内菜单项编码不得重复，保证命令定位稳定。
    CONSTRAINT uk_reference_data_context_menu_code UNIQUE (typeId, itemCode),
    -- 状态只接受删除、启用和停用三个生命周期值。
    CONSTRAINT ck_reference_data_context_menu_status CHECK (status IN (0, 1, 2))
);

-- 兼容早期正式库：只补充缺失审计字段，已有菜单层级、命令和图标保持不变。
ALTER TABLE ReferenceDataContextMenuItem ADD COLUMN IF NOT EXISTS tenantId BIGINT NOT NULL DEFAULT 1;
ALTER TABLE ReferenceDataContextMenuItem ADD COLUMN IF NOT EXISTS lastOperateUserId BIGINT NOT NULL DEFAULT 1;

-- 管理接口需要在数据库连接关闭后序列化扩展属性；统一使用足够大的 VARCHAR，避免驱动返回已关闭的 JdbcClob。
ALTER TABLE IF EXISTS ReferenceDataContextMenuItem ALTER COLUMN attributesJson VARCHAR(10000);

COMMENT ON TABLE ReferenceDataContextMenuItem IS '引用数据右键菜单项表';
COMMENT ON COLUMN ReferenceDataContextMenuItem.id IS '菜单项主键，由reference-data独立数据库生成';
COMMENT ON COLUMN ReferenceDataContextMenuItem.tenantId IS '数据所属租户标识';
COMMENT ON COLUMN ReferenceDataContextMenuItem.lastOperateUserId IS '最近维护数据的操作员标识';
COMMENT ON COLUMN ReferenceDataContextMenuItem.typeId IS '所属引用数据类型主键';
COMMENT ON COLUMN ReferenceDataContextMenuItem.parentId IS '父菜单项主键，顶级菜单为空';
COMMENT ON COLUMN ReferenceDataContextMenuItem.itemCode IS '类型内稳定菜单项编码';
COMMENT ON COLUMN ReferenceDataContextMenuItem.labelZh IS '菜单项中文显示文本';
COMMENT ON COLUMN ReferenceDataContextMenuItem.labelJa IS '菜单项日文显示文本';
COMMENT ON COLUMN ReferenceDataContextMenuItem.labelEn IS '菜单项英文显示文本';
COMMENT ON COLUMN ReferenceDataContextMenuItem.icon IS '公共图标库类名';
COMMENT ON COLUMN ReferenceDataContextMenuItem.command IS '叶子菜单触发的稳定业务命令';
COMMENT ON COLUMN ReferenceDataContextMenuItem.attributesJson IS '菜单项业务扩展属性JSON';
COMMENT ON COLUMN ReferenceDataContextMenuItem.disabled IS '菜单项是否展示但不可操作';
COMMENT ON COLUMN ReferenceDataContextMenuItem.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN ReferenceDataContextMenuItem.sortnum IS '同类型或同父菜单下的业务排序值';
COMMENT ON COLUMN ReferenceDataContextMenuItem.createdAt IS '数据创建时间';
COMMENT ON COLUMN ReferenceDataContextMenuItem.updatedAt IS '数据最后更新时间';

-- 菜单项按类型、状态和顺序输出时复用该索引。
CREATE INDEX IF NOT EXISTS idx_reference_data_context_menu_type_status_sort
    ON ReferenceDataContextMenuItem(typeId, status, sortnum, id);
