package com.sp.selplat.mda.connection.dao;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import org.springframework.stereotype.Repository;

/**
 * 将 DAO 类名映射到 {@code MdaConnectionProfile} 表。
 * 查询、写入、批处理和逻辑删除全部继承公共实现，本类不重复声明父类方法。
 */
@Repository
public class MdaConnectionProfileDaoImpl extends BaseDaoImpl implements MdaConnectionProfileDao {
}
