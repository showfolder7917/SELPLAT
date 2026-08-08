package com.sp.selplat.mda.connectionprofile.dao;

import com.sp.selplat.mda.common.persistence.MdaBaseDao;
import org.springframework.stereotype.Repository;

/**
 * 把 MdaConnectionProfile 固定表绑定到 MDA 专用控制库上下文。
 * 查询、号段定义和写入均复用公共 Base DAO，不直接拼接业务 SQL。
 */
@Repository
public class MdaConnectionProfileDaoImpl extends MdaBaseDao implements MdaConnectionProfileDao {
}
