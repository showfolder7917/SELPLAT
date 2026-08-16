-- ReferenceDataTreeNode 只保存独立树节点，并通过 parentId 组织层级关系。
CREATE TABLE IF NOT EXISTS ReferenceDataTreeNode (
    -- id 作为树节点主键，由当前 reference-data 独立数据库生成。
    id BIGINT PRIMARY KEY,
    -- code 是树节点表内唯一的公开坐标，格式为 treeNode 加本表 id。
    code VARCHAR(100) NOT NULL,
    -- tenantId 标识当前树节点所属租户。
    tenantId BIGINT NOT NULL DEFAULT 1,
    -- lastOperateUserId 记录最近维护该树节点的操作员。
    lastOperateUserId BIGINT NOT NULL DEFAULT 1,
    -- projectCode 只标识树节点来自哪个工程，不参与树关系计算。
    projectCode VARCHAR(64) NOT NULL,
    -- pageCode 只标识树节点来自哪个页面，不参与树关系计算。
    pageCode VARCHAR(100) NOT NULL,
    -- parentId 关联同表父节点；根节点保持为空。
    parentId BIGINT,
    -- nodeValue 保存业务系统实际提交或查询使用的稳定节点值。
    nodeValue VARCHAR(200) NOT NULL,
    -- labelZh 保存节点中文显示文本。
    labelZh VARCHAR(200) NOT NULL,
    -- labelJa 保存节点日文显示文本；未配置时由上层国际化回退策略处理。
    labelJa VARCHAR(200),
    -- labelEn 保存节点英文显示文本；未配置时由上层国际化回退策略处理。
    labelEn VARCHAR(200),
    -- status 保存逻辑状态：0 表示逻辑删除，1 表示启用，2 表示停用。
    status INTEGER NOT NULL DEFAULT 1,
    -- sortnum 保存同一父节点下的业务排序值。
    sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0,
    -- createdAt 保存树节点首次创建时间。
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 保存树节点最近更新时间。
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 父节点外键保证树形关系只能引用当前树节点表中的真实记录。
    CONSTRAINT fk_reference_data_tree_node_parent FOREIGN KEY (parentId) REFERENCES ReferenceDataTreeNode(id),
    CONSTRAINT uk_reference_data_tree_node_global_code UNIQUE (code),
    -- 状态只接受删除、启用和停用三个生命周期值。
    CONSTRAINT ck_reference_data_tree_node_status CHECK (status IN (0, 1, 2))
);

-- 旧文件库先幂等补充可空列，随后由 Java 启动迁移安全回填并收紧为非空。
ALTER TABLE ReferenceDataTreeNode ADD COLUMN IF NOT EXISTS projectCode VARCHAR(64) AFTER lastOperateUserId;
ALTER TABLE ReferenceDataTreeNode ADD COLUMN IF NOT EXISTS pageCode VARCHAR(100) AFTER projectCode;

COMMENT ON TABLE ReferenceDataTreeNode IS '独立引用数据树节点表';
COMMENT ON COLUMN ReferenceDataTreeNode.id IS '树节点主键，由reference-data独立数据库生成';
COMMENT ON COLUMN ReferenceDataTreeNode.code IS '树节点表内唯一的公开编码，由treeNode前缀和本表id组成';
COMMENT ON COLUMN ReferenceDataTreeNode.tenantId IS '数据所属租户标识';
COMMENT ON COLUMN ReferenceDataTreeNode.lastOperateUserId IS '最近维护数据的操作员标识';
COMMENT ON COLUMN ReferenceDataTreeNode.projectCode IS '树节点所属工程，仅用于归属展示和查询';
COMMENT ON COLUMN ReferenceDataTreeNode.pageCode IS '树节点所属页面，仅用于归属展示和查询';
COMMENT ON COLUMN ReferenceDataTreeNode.parentId IS '父树节点主键，根节点为空';
COMMENT ON COLUMN ReferenceDataTreeNode.nodeValue IS '业务提交和查询使用的稳定节点值';
COMMENT ON COLUMN ReferenceDataTreeNode.labelZh IS '树节点中文显示文本';
COMMENT ON COLUMN ReferenceDataTreeNode.labelJa IS '树节点日文显示文本';
COMMENT ON COLUMN ReferenceDataTreeNode.labelEn IS '树节点英文显示文本';
COMMENT ON COLUMN ReferenceDataTreeNode.status IS '逻辑状态：0删除、1启用、2停用';
COMMENT ON COLUMN ReferenceDataTreeNode.sortnum IS '同一父节点下的业务排序值';
COMMENT ON COLUMN ReferenceDataTreeNode.createdAt IS '数据创建时间';
COMMENT ON COLUMN ReferenceDataTreeNode.updatedAt IS '数据最后更新时间';

-- 管理页和树查询按状态、父节点与顺序读取。
CREATE INDEX IF NOT EXISTS idx_reference_data_tree_node_parent_status_sort
    ON ReferenceDataTreeNode(parentId, status, sortnum, id);

-- 管理页按工程和页面查看树节点时直接使用归属坐标，树关系仍只走 parentId。
CREATE INDEX IF NOT EXISTS idx_reference_data_tree_node_page_parent_sort
    ON ReferenceDataTreeNode(tenantId, projectCode, pageCode, parentId, status, sortnum, id);
