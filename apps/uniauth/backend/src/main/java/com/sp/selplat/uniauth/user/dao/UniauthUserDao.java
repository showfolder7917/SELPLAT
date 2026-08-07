package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.uniauth.persistence.UniauthTableMetadataDao;

/**
 * 用户 DAO 接口只作为模块类型标记，全部持久化能力统一继承 BaseDao 公共契约。
 */
public interface UniauthUserDao extends BaseDao, UniauthTableMetadataDao {
}
