-- ReferenceDataControlBinding 只登记页面控件与引用数据类型的稳定绑定，不复制类型坐标或具体选项。
CREATE TABLE IF NOT EXISTS ReferenceDataControlBinding (
    -- id 作为页面控件绑定主键，由 reference-data 独立数据库号段生成。
    id BIGINT PRIMARY KEY,
    -- tenantId 标识当前绑定所属租户，页面控件坐标只在租户内唯一。
    tenantId BIGINT NOT NULL DEFAULT 1,
    -- lastOperateUserId 记录最近维护该绑定的操作员。
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    -- pageProjectCode 保存控件所在业务项目编码，例如 reference-data 或 cms。
    pageProjectCode VARCHAR(64) NOT NULL,
    -- pagePath 保存控件所在页面路径，例如 /reference-data/reference-data.html。
    pagePath VARCHAR(500) NOT NULL,
    -- controlId 保存页面内稳定 SEL 控件实例 ID，例如 selDropdownArticleStatusId。
    controlId VARCHAR(100) NOT NULL,
    -- controlType 保存控件类型：DROPDOWN、TREE 或 CONTEXT_MENU。
    controlType VARCHAR(32) NOT NULL,
    -- typeId 关联 ReferenceDataType，运行时继续通过类型表取得项目与资源坐标。
    typeId BIGINT NOT NULL,
    -- description 保存管理员可读的控件用途说明。
    description VARCHAR(500),
    -- status 保存逻辑状态：0 表示逻辑删除，1 表示启用，2 表示停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存管理页面业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存绑定首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存绑定最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 类型外键保证页面控件只能绑定已经登记的引用数据类型。
    CONSTRAINT fk_reference_data_control_binding_type
        FOREIGN KEY (typeId) REFERENCES ReferenceDataType(id),
    -- 同一租户、项目和页面中的控件 ID 只能登记一次，保证页面控件可以唯一解析。
    CONSTRAINT uk_reference_data_control_binding_coordinate
        UNIQUE (tenantId, pageProjectCode, pagePath, controlId),
    -- 控件类型只接受当前已定义的三类引用数据消费者。
    CONSTRAINT ck_reference_data_control_binding_type
        CHECK (controlType IN ('DROPDOWN', 'TREE', 'CONTEXT_MENU')),
    -- 状态只接受删除、启用和停用三个生命周期值。
    CONSTRAINT ck_reference_data_control_binding_status CHECK (status IN (0, 1, 2))
);

COMMENT ON TABLE ReferenceDataControlBinding IS '页面控件与引用数据类型绑定表';
COMMENT ON COLUMN ReferenceDataControlBinding.id IS '页面控件绑定主键，由reference-data独立数据库号段生成';
COMMENT ON COLUMN ReferenceDataControlBinding.tenantId IS '绑定所属租户标识';
COMMENT ON COLUMN ReferenceDataControlBinding.lastOperateUserId IS '最近维护绑定的操作员标识';
COMMENT ON COLUMN ReferenceDataControlBinding.pageProjectCode IS '控件所在业务项目稳定编码';
COMMENT ON COLUMN ReferenceDataControlBinding.pagePath IS '控件所在页面访问路径';
COMMENT ON COLUMN ReferenceDataControlBinding.controlId IS '页面内稳定SEL控件实例ID';
COMMENT ON COLUMN ReferenceDataControlBinding.controlType IS '控件类型：DROPDOWN、TREE或CONTEXT_MENU';
COMMENT ON COLUMN ReferenceDataControlBinding.typeId IS '绑定的引用数据类型主键';
COMMENT ON COLUMN ReferenceDataControlBinding.description IS '页面控件用途说明';
COMMENT ON COLUMN ReferenceDataControlBinding.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN ReferenceDataControlBinding.sortnum IS '管理页面业务排序值';
COMMENT ON COLUMN ReferenceDataControlBinding.createdAt IS '绑定创建时间';
COMMENT ON COLUMN ReferenceDataControlBinding.updatedAt IS '绑定最后更新时间';

-- 运行时按租户和页面控件坐标解析启用绑定时复用该索引。
CREATE INDEX IF NOT EXISTS idx_reference_data_control_binding_lookup
    ON ReferenceDataControlBinding(tenantId, pageProjectCode, pagePath, controlId, status);

