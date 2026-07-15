package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.db.query.model.CommonPageResult;
import com.sp.selplat.common.util.CommonPageParam;

// 用户 DAO 接口在保留 store 兼容查询入口的同时，正式接入 common-db 的公共 DAO 能力。
public interface UniauthUserDao extends BaseDao {

    // store 兼容接口按共通分页参数返回统一分页结果，内部直接走 BaseDao 公共分页能力。
    CommonPageResult getStorePage(CommonPageParam queryIn);
}
