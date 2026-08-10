-- ReferenceDataType 只保存跨项目引用数据类型的稳定坐标、多语言名称和管理状态，不描述树或选项的实现能力。
CREATE TABLE IF NOT EXISTS ReferenceDataType (
    -- id 作为类型记录主键，由当前 reference-data 独立数据库生成，供树节点和管理接口稳定引用。
    id BIGINT PRIMARY KEY,
    -- projectCode 保存资源所属项目编码，例如 reference-data 或 cms，是跨项目隔离类型坐标的第一部分。
    projectCode VARCHAR(64) NOT NULL,
    -- resourceCode 保存项目内稳定资源编码，例如 resource-kind，与 projectCode 共同保证类型唯一。
    resourceCode VARCHAR(64) NOT NULL,
    -- nameZh 保存类型中文名称，中文界面和默认管理页面直接使用该值。
    nameZh VARCHAR(120) NOT NULL,
    -- nameJa 保存类型日文名称；未配置时由上层国际化回退策略处理。
    nameJa VARCHAR(120),
    -- nameEn 保存类型英文名称；未配置时由上层国际化回退策略处理。
    nameEn VARCHAR(120),
    -- descriptionZh 保存类型中文用途说明，帮助管理人员判断数据边界。
    descriptionZh VARCHAR(500),
    -- descriptionJa 保存类型日文用途说明。
    descriptionJa VARCHAR(500),
    -- descriptionEn 保存类型英文用途说明。
    descriptionEn VARCHAR(500),
    -- status 保存逻辑状态：0 表示逻辑删除，1 表示启用，2 表示停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存管理页面的业务排序值，数值越大时由当前查询规则优先展示。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存类型记录首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存类型记录最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 同一项目内资源编码不得重复，防止调用方命中不确定的类型定义。
    CONSTRAINT uk_reference_data_type_coordinate UNIQUE (projectCode, resourceCode),
    -- 状态只接受删除、启用和停用三个生命周期值。
    CONSTRAINT ck_reference_data_type_status CHECK (status IN (0, 1, 2))
);

-- 兼容旧数据库：旧版本 dataShape 只保存展示值且从未控制查询能力，升级时安全移除该约束和字段。
ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS ck_reference_data_type_shape;
ALTER TABLE ReferenceDataType DROP COLUMN IF EXISTS dataShape;

COMMENT ON TABLE ReferenceDataType IS '跨项目引用数据类型目录表';
COMMENT ON COLUMN ReferenceDataType.id IS '类型记录主键，由reference-data独立数据库生成';
COMMENT ON COLUMN ReferenceDataType.projectCode IS '资源所属项目稳定编码';
COMMENT ON COLUMN ReferenceDataType.resourceCode IS '项目内引用数据资源稳定编码';
COMMENT ON COLUMN ReferenceDataType.nameZh IS '类型中文名称';
COMMENT ON COLUMN ReferenceDataType.nameJa IS '类型日文名称';
COMMENT ON COLUMN ReferenceDataType.nameEn IS '类型英文名称';
COMMENT ON COLUMN ReferenceDataType.descriptionZh IS '类型中文用途说明';
COMMENT ON COLUMN ReferenceDataType.descriptionJa IS '类型日文用途说明';
COMMENT ON COLUMN ReferenceDataType.descriptionEn IS '类型英文用途说明';
COMMENT ON COLUMN ReferenceDataType.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN ReferenceDataType.sortnum IS '管理页面业务排序值';
COMMENT ON COLUMN ReferenceDataType.createdAt IS '数据创建时间';
COMMENT ON COLUMN ReferenceDataType.updatedAt IS '数据最后更新时间';

-- 类型列表按状态、业务顺序和主键查询时复用该索引，保证后台筛选和稳定排序不做全表扫描。
CREATE INDEX IF NOT EXISTS idx_reference_data_type_status_sort
    ON ReferenceDataType(status, sortnum, id);
