-- ReferenceDataType 保存可被多个页面控件复用的分级选项值及其多语言名称。
CREATE TABLE IF NOT EXISTS ReferenceDataType (
    -- id 作为类型记录主键，由当前 reference-data 独立数据库生成。
    id BIGINT PRIMARY KEY,
    -- code 是外部接口使用的不可变记录坐标，例如 type101001。
    code VARCHAR(100) NOT NULL,
    -- tenantId 标识当前类型所属租户。
    tenantId BIGINT NOT NULL DEFAULT 1,
    -- lastOperateUserId 记录最近维护该类型的操作员。
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    -- optionSetCode 标识一组可由页面和 Window 内多个控件共同使用的选项。
    optionSetCode VARCHAR(100) NOT NULL,
    -- valueCode 是使用该选项组的控件提交给业务接口的稳定类型值。
    valueCode VARCHAR(100) NOT NULL,
    -- parentTypeCode 关联同一选项组内的上级类型；顶级类型保持为空。
    parentTypeCode VARCHAR(100),
    -- nameZh 保存类型值中文名称。
    nameZh VARCHAR(120) NOT NULL,
    -- nameJa 保存分类日文名称；未配置时由上层国际化回退策略处理。
    nameJa VARCHAR(120),
    -- nameEn 保存分类英文名称；未配置时由上层国际化回退策略处理。
    nameEn VARCHAR(120),
    -- status 保存逻辑状态：0 表示逻辑删除，1 表示启用，2 表示停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存管理页面的业务排序值，数值越大时优先展示。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存类型记录首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存类型记录最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reference_data_type_code UNIQUE (code),
    CONSTRAINT uk_reference_data_type_option_value UNIQUE (tenantId, optionSetCode, valueCode),
    CONSTRAINT uk_reference_data_type_option_code UNIQUE (optionSetCode, code),
    CONSTRAINT fk_reference_data_type_parent FOREIGN KEY (optionSetCode, parentTypeCode)
        REFERENCES ReferenceDataType(optionSetCode, code),
    CONSTRAINT ck_reference_data_type_parent_not_self CHECK (parentTypeCode IS NULL OR parentTypeCode <> code),
    CONSTRAINT ck_reference_data_type_status CHECK (status IN (0, 1, 2))
);

-- 已有数据库先获得新列，正式数据迁移由固定启动迁移完成后物理删除 categoryCode/controlCode。
ALTER TABLE ReferenceDataType ADD COLUMN IF NOT EXISTS optionSetCode VARCHAR(100);
ALTER TABLE ReferenceDataType ADD COLUMN IF NOT EXISTS valueCode VARCHAR(100);
ALTER TABLE ReferenceDataType ADD COLUMN IF NOT EXISTS parentTypeCode VARCHAR(100);

COMMENT ON TABLE ReferenceDataType IS '可复用选项组的类型值及分级菜单目录表';
COMMENT ON COLUMN ReferenceDataType.id IS '类型记录主键，由reference-data独立数据库生成';
COMMENT ON COLUMN ReferenceDataType.code IS '类型记录的唯一公开编码';
COMMENT ON COLUMN ReferenceDataType.tenantId IS '数据所属租户标识';
COMMENT ON COLUMN ReferenceDataType.lastOperateUserId IS '最近维护数据的操作员标识';
COMMENT ON COLUMN ReferenceDataType.optionSetCode IS '多个页面或Window控件可共享的选项组code';
COMMENT ON COLUMN ReferenceDataType.valueCode IS '控件提交给业务接口的稳定类型值';
COMMENT ON COLUMN ReferenceDataType.parentTypeCode IS '同一选项组内的上级类型code，顶级为空';
COMMENT ON COLUMN ReferenceDataType.nameZh IS '类型值中文名称';
COMMENT ON COLUMN ReferenceDataType.nameJa IS '类型值日文名称';
COMMENT ON COLUMN ReferenceDataType.nameEn IS '类型值英文名称';
COMMENT ON COLUMN ReferenceDataType.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN ReferenceDataType.sortnum IS '管理页面业务排序值';
COMMENT ON COLUMN ReferenceDataType.createdAt IS '数据创建时间';
COMMENT ON COLUMN ReferenceDataType.updatedAt IS '数据最后更新时间';

-- 类型列表按状态、业务顺序和主键查询时复用该索引。
CREATE INDEX IF NOT EXISTS idx_reference_data_type_status_sort
    ON ReferenceDataType(status, sortnum, id);
-- 控件加载选项组顶级或子级类型时直接按 code 查询，不需要先转换数据库 id。
CREATE INDEX IF NOT EXISTS idx_reference_data_type_option_parent_sort
    ON ReferenceDataType(optionSetCode, parentTypeCode, status, sortnum, id);
