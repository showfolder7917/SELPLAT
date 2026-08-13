-- ReferenceDataOption 只保存某个引用数据类型下的下拉选项，不与树节点或右键菜单混用。
CREATE TABLE IF NOT EXISTS ReferenceDataOption (
    -- id 作为下拉选项主键，由当前 reference-data 独立数据库生成。
    id BIGINT PRIMARY KEY,
    -- tenantId 标识当前选项所属租户。
    tenantId BIGINT NOT NULL DEFAULT 1,
    -- lastOperateUserId 记录最近维护该选项的操作员。
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    -- typeId 关联所属 ReferenceDataType，所有选项必须归属于一个明确类型。
    typeId BIGINT NOT NULL,
    -- optionValue 保存业务表单提交和接口传输使用的稳定选项值。
    optionValue VARCHAR(200) NOT NULL,
    -- labelZh 保存选项中文显示文本。
    labelZh VARCHAR(200) NOT NULL,
    -- labelJa 保存选项日文显示文本；未配置时由上层国际化回退策略处理。
    labelJa VARCHAR(200),
    -- labelEn 保存选项英文显示文本；未配置时由上层国际化回退策略处理。
    labelEn VARCHAR(200),
    -- groupCode 保存同一类型内的可选分组编码，未分组时保持为空。
    groupCode VARCHAR(100),
    -- attributesJson 保存选项业务扩展属性 JSON，不承载固定平台字段。
    attributesJson VARCHAR(10000),
    -- disabled 标识选项是否展示但禁止选择，与记录生命周期状态相互独立。
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- status 保存逻辑状态：0 表示逻辑删除，1 表示启用，2 表示停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存同类型或同分组下的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存选项首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存选项最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 类型外键保证选项不会脱离类型目录独立存在。
    CONSTRAINT fk_reference_data_option_type FOREIGN KEY (typeId) REFERENCES ReferenceDataType(id),
    -- 同一类型内选项值不得重复，保证业务提交值只对应一条记录。
    CONSTRAINT uk_reference_data_option_value UNIQUE (typeId, optionValue),
    -- 状态只接受删除、启用和停用三个生命周期值。
    CONSTRAINT ck_reference_data_option_status CHECK (status IN (0, 1, 2))
);

-- 兼容早期正式库：只补充缺失审计字段，已有选项值和启停状态保持不变。
ALTER TABLE ReferenceDataOption ADD COLUMN IF NOT EXISTS tenantId BIGINT NOT NULL DEFAULT 1;
ALTER TABLE ReferenceDataOption ADD COLUMN IF NOT EXISTS lastOperateUserId BIGINT NOT NULL DEFAULT 1;

-- 管理接口需要在数据库连接关闭后序列化扩展属性；统一使用足够大的 VARCHAR，避免驱动返回已关闭的 JdbcClob。
ALTER TABLE IF EXISTS ReferenceDataOption ALTER COLUMN attributesJson VARCHAR(10000);

COMMENT ON TABLE ReferenceDataOption IS '引用数据下拉选项表';
COMMENT ON COLUMN ReferenceDataOption.id IS '下拉选项主键，由reference-data独立数据库生成';
COMMENT ON COLUMN ReferenceDataOption.tenantId IS '数据所属租户标识';
COMMENT ON COLUMN ReferenceDataOption.lastOperateUserId IS '最近维护数据的操作员标识';
COMMENT ON COLUMN ReferenceDataOption.typeId IS '所属引用数据类型主键';
COMMENT ON COLUMN ReferenceDataOption.optionValue IS '提交给业务接口的稳定选项值';
COMMENT ON COLUMN ReferenceDataOption.labelZh IS '选项中文显示文本';
COMMENT ON COLUMN ReferenceDataOption.labelJa IS '选项日文显示文本';
COMMENT ON COLUMN ReferenceDataOption.labelEn IS '选项英文显示文本';
COMMENT ON COLUMN ReferenceDataOption.groupCode IS '类型内可选分组编码';
COMMENT ON COLUMN ReferenceDataOption.attributesJson IS '选项业务扩展属性JSON';
COMMENT ON COLUMN ReferenceDataOption.disabled IS '选项是否展示但不可选择';
COMMENT ON COLUMN ReferenceDataOption.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN ReferenceDataOption.sortnum IS '同类型或同分组下的业务排序值';
COMMENT ON COLUMN ReferenceDataOption.createdAt IS '数据创建时间';
COMMENT ON COLUMN ReferenceDataOption.updatedAt IS '数据最后更新时间';

-- 下拉选项按类型、状态和顺序输出时复用该索引。
CREATE INDEX IF NOT EXISTS idx_reference_data_option_type_status_sort
    ON ReferenceDataOption(typeId, status, sortnum, id);
