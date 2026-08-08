MERGE INTO UniauthTenant (id, tenantId, lastOperateUserId, tenantCode, tenantName, tenantStatus, contactName, contactEmail, contactPhone, sortnum, status)
KEY(id)
VALUES
  (1, 1, 1, 'DEFAULT', '默认租户', 'enabled', '平台管理员', 'admin@selplat.com', '03-0000-0000', 10.00, 1);
