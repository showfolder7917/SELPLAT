package com.sp.selplat.uniauth.user.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;

/**
 * 用户服务统一使用公共入参与固定的 {@link CommonResult}/{@link CommonPageResult} 回参。
 * 前端字段从控制器原样进入公共服务链，用户模块只保留密码摘要等模块特有处理。
 */
public interface UniauthUserService extends BaseService {

    /**
     * 按分页参数查询用户列表。
     *
     * @param queryIn 前端分页与筛选参数，例如
     *     {@code {"pageNo":1,"pageSize":10,"paramMap":{"userStatus":"ACTIVE"}}}
     * @return 固定分页结果，例如
     *     {@code {"result":"success","dataList":[{"id":10001,"loginName":"admin"}],}
     *     {@code "total":1,"pageNo":1,"pageSize":10}
     */
    CommonPageResult getStore(CommonPageParam queryIn);

    /**
     * 按单组主键查询用户详情。
     *
     * @param queryIn 前端主键参数，例如 {@code {"paramMap":{"id":10001}}}
     * @return 固定结果，例如
     *     {@code {"result":"success","data":{"id":10001,"loginName":"admin","userStatus":"ACTIVE"}}
     */
    CommonResult getById(CommonParam queryIn);

    /**
     * 按多组单主键或复合主键查询用户详情。
     *
     * @param queryIn 前端批量主键参数，例如
     *     {@code {"items":[{"paramMap":{"id":10001}},{"paramMap":{"id":10002}}]}
     * @return 固定结果，例如
     *     {@code {"result":"success","data":[{"id":10001,"loginName":"admin"},}
     *     {@code {"id":10002,"loginName":"operator"}]}
     */
    CommonResult getByIds(CommonBatchParam queryIn);

    /**
     * 新增单个用户并把明文密码转换为摘要。
     *
     * @param saveIn 前端新增字段，例如
     *     {@code {"paramMap":{"tenantId":1,"loginName":"admin","password":"secret"}}
     * @return 固定结果，例如
     *     {@code {"result":"success","affectedRows":1,"data":{"id":10001,"loginName":"admin"}}
     */
    CommonResult insert(CommonParam saveIn);

    /**
     * 批量新增用户，每一千条作为一个模板批次执行。
     *
     * @param saveIn 前端批量新增字段，例如
     *     {@code {"items":[{"paramMap":{"tenantId":1,"loginName":"admin","password":"secret"}}]}
     * @return 固定结果，例如
     *     {@code {"result":"success","affectedRows":1,"data":[{"id":10001,"loginName":"admin"}]}
     */
    CommonResult insertBatch(CommonBatchParam saveIn);

    /**
     * 按主键更新单个用户。
     *
     * @param saveIn 前端主键和更新字段，例如
     *     {@code {"paramMap":{"id":10001,"displayName":"系统管理员"}}
     * @return 固定结果，例如
     *     {@code {"result":"success","affectedRows":1,"data":{"id":10001,"displayName":"系统管理员"}}
     */
    CommonResult update(CommonParam saveIn);

    /**
     * 批量更新用户，全部模板批次处于同一事务。
     *
     * @param saveIn 前端批量主键和更新字段，例如
     *     {@code {"items":[{"paramMap":{"id":10001,"userStatus":"LOCKED"}}]}
     * @return 固定结果，例如
     *     {@code {"result":"success","affectedRows":1,"data":[{"id":10001,"userStatus":"LOCKED"}]}
     */
    CommonResult updateBatch(CommonBatchParam saveIn);

    /**
     * 按主键假删除单个用户。
     *
     * @param deleteIn 前端主键和审计字段，例如 {@code {"paramMap":{"id":10001,"updatedBy":90001}}}
     * @return 固定结果，例如 {@code {"result":"success","affectedRows":1,"data":{"id":10001}}}
     */
    CommonResult delete(CommonParam deleteIn);

    /**
     * 批量假删除用户，不开放物理删除。
     *
     * @param deleteIn 前端批量主键和审计字段，例如
     *     {@code {"items":[{"paramMap":{"id":10001,"updatedBy":90001}}]}
     * @return 固定结果，例如
     *     {@code {"result":"success","affectedRows":1,"data":[{"id":10001}]}
     */
    CommonResult deleteBatch(CommonBatchParam deleteIn);
}
