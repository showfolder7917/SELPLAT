package com.sp.selplat.uniauth.user.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;

// 用户服务统一使用共通入参和共通回参，避免模块继续维护专用的 In/Out 传输对象。
public interface UniauthUserService extends BaseService {

    // store 兼容接口只返回统一分页查询结果，控制层再决定如何包装成旧式页面需要的 JSON 结构。
    CommonPageResult getStore(CommonPageParam queryIn);

    // 根据主键查询单个用户详情，供编辑页和详情页按共通返回对象读取主表数据。
    CommonResult getById(CommonParam queryIn);

    // 新增用户时统一由服务层生成主键、填充默认状态并按共通返回对象回显结果。
    CommonResult create(CommonParam saveIn);

    // 更新用户时统一校验目标主键并回写最近操作用户和更新时间。
    CommonResult update(CommonParam saveIn);

    // 删除用户统一执行假删除，把 status 更新为 0 并记录最近操作用户。
    CommonResult delete(CommonParam deleteIn);
}
