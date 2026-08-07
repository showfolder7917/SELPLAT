package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.uniauth.common.persistence.UniauthBaseDao;
import org.springframework.stereotype.Repository;

// 用户 DAO 实现只保留 Spring 仓储类型入口，全部查询与写入能力由 BaseDao 继承链统一提供。
@Repository
public class UniauthUserDaoImpl extends UniauthBaseDao implements UniauthUserDao {
}
