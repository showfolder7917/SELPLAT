package com.sp.selplat.uniauth.user.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;

// 用户服务统一使用共通入参和共通回参，避免模块继续维护专用的 In/Out 传输对象。
public interface UniauthUserService extends BaseService {

    // 前端传入 pageNo、pageSize 和任意允许查询的动态字段；服务层直接返回统一分页结果。
    CommonPageResult getStore(CommonPageParam queryIn);

    // 前端传入 id；服务层按主键查询单个用户详情并返回共通结果。
    CommonResult getById(CommonParam queryIn);

    // 前端通过 items 传入多组单主键或复合主键；服务层返回批量详情结果。
    CommonResult getByIds(CommonBatchParam queryIn);

    // 前端直接传入新增字段；当前服务只补主键并转换密码，统一验证将在后续公共能力中处理。
    CommonResult insert(CommonParam saveIn);

    // 前端通过 items 批量传入新增字段；服务层逐项补主键和密码摘要后按一千条分组落库。
    CommonResult insertBatch(CommonBatchParam saveIn);

    // 前端直接传入主键和更新字段；DAO 自动分离主键条件，统一验证将在后续公共能力中处理。
    CommonResult update(CommonParam saveIn);

    // 前端通过 items 批量传入主键和更新字段；全部分组在同一事务内更新。
    CommonResult updateBatch(CommonBatchParam saveIn);

    // 前端直接传入主键和审计字段；DAO 自动提取主键并补充逻辑删除状态。
    CommonResult delete(CommonParam deleteIn);

    // 前端通过 items 批量传入主键和审计字段；服务层只开放批量假删除。
    CommonResult deleteBatch(CommonBatchParam deleteIn);
}
