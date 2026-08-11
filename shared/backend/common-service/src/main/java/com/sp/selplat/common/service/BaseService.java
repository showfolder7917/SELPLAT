package com.sp.selplat.common.service;

import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 统一声明简单单表业务 Service 的分页、查询、写入和假删除能力。
 * 业务 Service 直接继承本接口并只声明确有差异的业务动作，不再建立平行 CRUD 基础接口。
 */
public interface BaseService {

    /**
     * 返回业务配置优先、真实字段名静默后备的标准 SEL Grid 列定义。
     *
     * @param viewCode 页面表格实例编码，例如 {@code "selGridUserManagementId"}
     * @param locale 页面当前语言，例如 {@code "zh-CN"}
     * @return 配置命中时返回中文表格头；配置不存在或不可用时返回
     *     {@code {"source":"DEFAULT_FIELD_NAME","columns":[{"field":"loginName","label":"loginName"}]}}
     */
    CommonResult getGridColumn(String viewCode, String locale);

    /**
     * 分页查询当前业务表。
     *
     * @param queryIn 前端分页和筛选参数，例如 {@code {"pageNo":1,"pageSize":10,"status":1}}
     * @return 分页结果，例如
     *     {@code {"records":[{"id":1}],"totalCount":1,"pageNo":1,"pageSize":10}}
     */
    CommonPageResult getStore(CommonPageParam queryIn);

    /**
     * 按单主键或复合主键查询详情。
     *
     * @param queryIn 主键参数，例如 {@code {"id":1}} 或 {@code {"tenantId":10,"orderId":20}}
     * @return 详情结果，例如 {@code {"success":true,"data":{"id":1},"msg":"详情查询完成。"}}
     */
    CommonResult getById(CommonParam queryIn);

    /**
     * 按多组主键批量查询详情。
     *
     * @param queryIn 多组主键参数，例如 {@code {"items":[{"id":1},{"id":2}]}}
     * @return 批量详情结果，例如 {@code {"success":true,"data":[{"id":1},{"id":2}]}}
     */
    CommonResult getByIds(CommonBatchParam queryIn);

    /**
     * 新增一条业务记录。
     *
     * @param saveIn 待新增字段，例如 {@code {"loginName":"admin","displayName":"管理员"}}
     * @return 含生成主键的新增结果，例如 {@code {"success":true,"data":{"id":100001}}}
     */
    CommonResult insert(CommonParam saveIn);

    /**
     * 批量新增业务记录。
     *
     * @param saveIn 待新增项，例如 {@code {"items":[{"loginName":"admin"},{"loginName":"auditor"}]}}
     * @return 批量新增结果，例如 {@code {"success":true,"affectedRows":2}}
     */
    CommonResult insertBatch(CommonBatchParam saveIn);

    /**
     * 按主键更新一条业务记录。
     *
     * @param saveIn 主键和更新字段，例如 {@code {"id":1,"displayName":"管理员"}}
     * @return 更新结果，例如 {@code {"success":true,"data":{"id":1,"displayName":"管理员"}}}
     */
    CommonResult update(CommonParam saveIn);

    /**
     * 批量更新业务记录。
     *
     * @param saveIn 多组主键和更新字段，例如 {@code {"items":[{"id":1,"status":0},{"id":2,"status":0}]}}
     * @return 批量更新结果，例如 {@code {"success":true,"affectedRows":2}}
     */
    CommonResult updateBatch(CommonBatchParam saveIn);

    /**
     * 按主键假删除一条业务记录。
     *
     * @param deleteIn 主键和审计字段，例如 {@code {"id":1,"lastOperateUserId":9}}
     * @return 假删除结果，例如 {@code {"success":true,"data":{"id":1,"status":0}}}
     */
    CommonResult delete(CommonParam deleteIn);

    /**
     * 批量假删除业务记录。
     *
     * @param deleteIn 多组主键和审计字段，例如 {@code {"items":[{"id":1},{"id":2}]}}
     * @return 批量假删除结果，例如 {@code {"success":true,"affectedRows":2}}
     */
    CommonResult deleteBatch(CommonBatchParam deleteIn);
}
