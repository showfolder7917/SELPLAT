package com.sp.selplat.uniauth.user.service;

import com.sp.selplat.common.db.query.model.CommonPageResult;
import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonPageParam;

// 用户服务当前只保留 store 兼容查询入口，供控制层统一包装旧式页面返回结构。
public interface UniauthUserService extends BaseService {

    // store 兼容接口只返回统一分页查询结果，控制层再决定如何包装成旧式页面需要的 JSON 结构。
    CommonPageResult getStore(CommonPageParam queryIn);
}
