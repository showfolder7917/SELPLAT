MERGE INTO ua_tenant (id, tenant_code, tenant_name, tenant_status, contact_name, contact_email, contact_phone)
KEY(id)
VALUES
  (1, 'DEFAULT', '默认租户', 'enabled', '平台管理员', 'admin@selplat.com', '03-0000-0000');

MERGE INTO UniauthUser (id, tenantId, loginName, passwordHash, displayName, displayNameKana, locale, email, phone, userStatus, lockedFlag)
KEY(id)
VALUES
  (1, 1, 'admin', '4d186321c1a7f0f354b297e8914ab240', '平台管理员', 'プラットフォーム管理者', 'zh-CN', 'admin@selplat.com', '03-0000-0000', 'ACTIVE', 0),
  (2, 1, 'tenant-admin', '4d186321c1a7f0f354b297e8914ab240', '租户管理员', 'テナント管理者', 'ja-JP', 'tenant@selplat.com', '03-1111-1111', 'ACTIVE', 0);
