package com.sp.selplat.uniauth.user.service;

import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;

// 用户服务当前只保留 store 兼容入口，供旧式页面继续通过统一 JSON 结构联调。
public interface UniauthUserService {

    // store 兼容接口返回旧式页面联调所需的统一 JSON 字符串结构。
    String getStore(UniauthUserIn queryIn);
}
