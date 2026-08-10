package com.sp.selplat.uniauth.tenant.dao;

import com.sp.selplat.uniauth.common.persistence.UniauthBaseDao;
import org.springframework.stereotype.Repository;

/**
 * 把 UniauthTenant 真实表绑定到 Uniauth 私有数据源和公共 DAO 实现。
 */
@Repository
public class UniauthTenantDaoImpl extends UniauthBaseDao implements UniauthTenantDao {
}
