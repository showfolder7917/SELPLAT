-- 平台管理员按稳定登录名补齐，应用重启不得覆盖后台已经维护的用户资料。
INSERT INTO UniauthUser (
    id, tenantId, lastOperateUserId, loginName, passwordHash, displayName,
    displayNameKana, locale, email, phone, userStatus, lockedFlag, sortnum, status
) SELECT
    1, 1, 1, 'admin', '4d186321c1a7f0f354b297e8914ab240', '平台管理员',
    'プラットフォーム管理者', 'zh-CN', 'admin@selplat.com', '03-0000-0000',
    'ACTIVE', 0, 10.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM UniauthUser WHERE loginName = 'admin'
);

-- 租户管理员使用独立稳定登录名，只在记录缺失时初始化。
INSERT INTO UniauthUser (
    id, tenantId, lastOperateUserId, loginName, passwordHash, displayName,
    displayNameKana, locale, email, phone, userStatus, lockedFlag, sortnum, status
) SELECT
    2, 1, 1, 'tenant-admin', '4d186321c1a7f0f354b297e8914ab240', '租户管理员',
    'テナント管理者', 'ja-JP', 'tenant@selplat.com', '03-1111-1111',
    'ACTIVE', 0, 20.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM UniauthUser WHERE loginName = 'tenant-admin'
);
