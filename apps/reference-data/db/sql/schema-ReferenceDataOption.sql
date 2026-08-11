-- ReferenceDataOption 只保存某个引用数据类型下的下拉选项，不与树节点或右键菜单混用。
CREATE TABLE IF NOT EXISTS ReferenceDataOption (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL DEFAULT 1,
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    typeId BIGINT NOT NULL,
    optionValue VARCHAR(200) NOT NULL,
    labelZh VARCHAR(200) NOT NULL,
    labelJa VARCHAR(200),
    labelEn VARCHAR(200),
    groupCode VARCHAR(100),
    attributesJson CLOB,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    status INTEGER NOT NULL DEFAULT 1,
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reference_data_option_type FOREIGN KEY (typeId) REFERENCES ReferenceDataType(id),
    CONSTRAINT uk_reference_data_option_value UNIQUE (typeId, optionValue),
    CONSTRAINT ck_reference_data_option_status CHECK (status IN (0, 1, 2))
);

-- 管理接口需要在数据库连接关闭后序列化扩展属性；统一使用足够大的 VARCHAR，避免驱动返回已关闭的 JdbcClob。
ALTER TABLE IF EXISTS ReferenceDataOption ALTER COLUMN attributesJson VARCHAR(10000);

COMMENT ON TABLE ReferenceDataOption IS '引用数据下拉选项表';
COMMENT ON COLUMN ReferenceDataOption.tenantId IS '数据所属租户标识';
COMMENT ON COLUMN ReferenceDataOption.lastOperateUserId IS '最近维护数据的操作员标识';
COMMENT ON COLUMN ReferenceDataOption.typeId IS '所属引用数据类型主键';
COMMENT ON COLUMN ReferenceDataOption.optionValue IS '提交给业务接口的稳定选项值';
COMMENT ON COLUMN ReferenceDataOption.disabled IS '选项是否展示但不可选择';

CREATE INDEX IF NOT EXISTS idx_reference_data_option_type_status_sort
    ON ReferenceDataOption(typeId, status, sortnum, id);
