package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import java.util.List;
import java.util.Map;

// 用户 DAO 接口当前只保留 store 兼容查询入口，供旧式页面继续复用模板查询能力。
public interface UniauthUserDao {

    // store 兼容接口按查询对象返回旧式 rows 结构，内部统一走 BaseDao 模板查询。
    List<Map<String, Object>> getStoreList(UniauthUserIn queryIn);
}
