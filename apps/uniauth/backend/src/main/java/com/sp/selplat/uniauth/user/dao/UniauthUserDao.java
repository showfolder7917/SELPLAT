package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import java.util.List;
import java.util.Map;

// 用户 DAO 接口在保留 store 兼容查询入口的同时，正式接入 common-db 的公共 DAO 能力。
public interface UniauthUserDao extends BaseDao {

    // store 兼容接口按查询对象返回旧式 rows 结构，内部统一走 BaseDao 模板查询。
    List<Map<String, Object>> getStoreList(UniauthUserIn queryIn);
}
