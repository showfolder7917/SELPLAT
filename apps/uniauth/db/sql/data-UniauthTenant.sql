-- 默认租户按稳定业务编码补齐，应用重启不得覆盖后台已经维护的名称、状态或联系人。
INSERT INTO UniauthTenant (
    id, tenantId, lastOperateUserId, tenantCode, tenantName, tenantStatus,
    contactName, contactEmail, contactPhone, sortnum, status
) SELECT
    1, 1, 1, 'DEFAULT', '默认租户', 'enabled',
    '平台管理员', 'admin@selplat.com', '03-0000-0000', 10.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM UniauthTenant WHERE tenantCode = 'DEFAULT'
);
