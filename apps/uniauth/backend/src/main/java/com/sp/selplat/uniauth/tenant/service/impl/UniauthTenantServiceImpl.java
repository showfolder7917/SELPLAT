package com.sp.selplat.uniauth.tenant.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.uniauth.tenant.dao.UniauthTenantDao;
import com.sp.selplat.uniauth.tenant.service.UniauthTenantService;
import org.springframework.stereotype.Service;

/**
 * 把 UniauthTenant 唯一业务 Service 绑定到租户 DAO，公共 CRUD 由共享基类完成。
 */
@Service
public class UniauthTenantServiceImpl
        extends BaseServiceImpl<UniauthTenantDao>
        implements UniauthTenantService {
}
