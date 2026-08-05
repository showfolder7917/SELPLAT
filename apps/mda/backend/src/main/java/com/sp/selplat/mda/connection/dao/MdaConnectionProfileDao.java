package com.sp.selplat.mda.connection.dao;

import com.sp.selplat.common.db.dao.BaseDao;

/**
 * 连接配置 DAO 只声明当前表类型，全部单表持久化能力复用公共 {@link BaseDao}。
 */
public interface MdaConnectionProfileDao extends BaseDao {
}
