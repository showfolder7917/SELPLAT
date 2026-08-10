-- UniauthUser 保存统一认证用户账号，当前本地联调主要依赖这里的管理员种子数据完成登录与用户查询验证。
CREATE TABLE IF NOT EXISTS UniauthUser (
    -- id 作为用户记录标识，供认证、权限和后续业务域稳定关联。
    id BIGINT PRIMARY KEY,
    -- tenantId 表达用户所属租户标识，所有用户记录都必须落到明确租户边界下。
    tenantId BIGINT NOT NULL,
    -- lastOperateUserId 记录最后操作该用户数据的用户标识，便于主表直接回看最近维护责任人。
    lastOperateUserId BIGINT NOT NULL,
    -- loginName 与 UniauthUser#loginName 完全一致，要求唯一，供认证入口直接按账号检索用户。
    loginName VARCHAR(100) NOT NULL UNIQUE,
    -- passwordHash 与 UniauthUser#passwordHash 完全一致，保存加密后的口令摘要。
    passwordHash VARCHAR(255) NOT NULL,
    -- displayName 与 UniauthUser#displayName 完全一致，保存用户中文或默认展示名。
    displayName VARCHAR(100) NOT NULL,
    -- displayNameKana 与 UniauthUser#displayNameKana 完全一致，兼容日语场景下的人名检索和显示。
    displayNameKana VARCHAR(100),
    -- locale 记录用户默认语言区域，默认 zh-CN 方便本地最小运行直接使用中文界面。
    locale VARCHAR(20) DEFAULT 'zh-CN',
    -- email 保存用户邮箱，供通知和账号资料展示使用。
    email VARCHAR(100),
    -- phone 保存用户联系电话，供资料页和后续通知场景使用。
    phone VARCHAR(50),
    -- userStatus 与 UniauthUser#userStatus 完全一致，表示账号是否有效，默认 ACTIVE 让初始化管理员可直接登录。
    userStatus VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    -- lockedFlag 与 UniauthUser#lockedFlag 完全一致，表示账号是否被锁定，默认 0 代表未锁定。
    lockedFlag TINYINT DEFAULT 0,
    -- expiredAt 与 UniauthUser#expiredAt 完全一致，表达账号到期时间。
    expiredAt TIMESTAMP,
    -- sortnum 保存手工排序值，便于账号列表按业务顺序稳定展示。
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    -- status 与 Domain#status 一致，默认 1 表示有效，0 表示逻辑删除。
    status INTEGER NOT NULL DEFAULT 1,
    -- createdAt 与 Domain#createdAt 完全一致，记录用户创建时间。
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- updatedAt 与 Domain#updatedAt 完全一致，记录用户最后更新时间。
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 兼容旧库 identity 主键：保留已有用户记录，只移除自增属性，后续统一使用 UniauthUserId 号段。
ALTER TABLE IF EXISTS UniauthUser ALTER COLUMN id BIGINT;

COMMENT ON TABLE UniauthUser IS '统一认证用户主表';
COMMENT ON COLUMN UniauthUser.id IS '用户主记录标识';
COMMENT ON COLUMN UniauthUser.tenantId IS '用户所属租户标识';
COMMENT ON COLUMN UniauthUser.lastOperateUserId IS '最近操作用户标识';
COMMENT ON COLUMN UniauthUser.loginName IS '登录账号';
COMMENT ON COLUMN UniauthUser.passwordHash IS '口令摘要';
COMMENT ON COLUMN UniauthUser.displayName IS '默认展示姓名';
COMMENT ON COLUMN UniauthUser.displayNameKana IS '姓名假名';
COMMENT ON COLUMN UniauthUser.locale IS '默认语言区域';
COMMENT ON COLUMN UniauthUser.email IS '联系邮箱';
COMMENT ON COLUMN UniauthUser.phone IS '联系电话';
COMMENT ON COLUMN UniauthUser.userStatus IS '账号业务状态';
COMMENT ON COLUMN UniauthUser.lockedFlag IS '锁定标记';
COMMENT ON COLUMN UniauthUser.expiredAt IS '账号到期时间';
COMMENT ON COLUMN UniauthUser.sortnum IS '业务排序值';
COMMENT ON COLUMN UniauthUser.status IS '逻辑状态标记';
COMMENT ON COLUMN UniauthUser.createdAt IS '数据创建时间';
COMMENT ON COLUMN UniauthUser.updatedAt IS '数据更新时间';
