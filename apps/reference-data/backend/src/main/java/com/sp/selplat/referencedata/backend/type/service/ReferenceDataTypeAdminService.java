package com.sp.selplat.referencedata.backend.type.service;

import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 声明引用数据类型管理页使用的列表、详情、新增、更新和逻辑删除能力。
 * 返回结构固定使用公共结果类型，Controller 只负责 JSON 序列化。
 */
public interface ReferenceDataTypeAdminService {

    /**
     * 查询类型管理分页列表。
     *
     * @param queryIn 前端分页与筛选参数，例如
     *     {@code {"pageNo":1,"pageSize":20,"keyword":"resource","status":1}}
     * @return 公共分页结果，例如
     *     {@code {"records":[{"id":1,"projectCode":"reference-data"}],"totalCount":1,"pageNo":1,"pageSize":20}}
     */
    CommonPageResult getStore(CommonPageParam queryIn);

    /**
     * 查询一条类型详情。
     *
     * @param id 数据库生成主键，例如 {@code 1}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":{"id":1,"resourceCode":"resource-kind"},"msg":"类型详情查询完成。"}}
     */
    CommonResult getById(long id);

    /**
     * 新增一条引用数据类型。
     *
     * @param saveIn 前端表单字段，例如
     *     {@code {"projectCode":"cms","resourceCode":"article-category","nameZh":"文章分类","status":1}}
     * @return 含数据库生成主键的固定结果，例如
     *     {@code {"success":true,"data":{"id":2,"projectCode":"cms"},"affectedRows":1,"msg":"类型新增完成。"}}
     */
    CommonResult insert(CommonParam saveIn);

    /**
     * 更新一条引用数据类型。
     *
     * @param id 数据库生成主键，例如 {@code 2}
     * @param saveIn 前端最新字段，例如 {@code {"nameZh":"内容分类","status":2}}
     * @return 更新后详情，例如
     *     {@code {"success":true,"data":{"id":2,"nameZh":"内容分类","status":2},"affectedRows":1,"msg":"类型更新完成。"}}
     */
    CommonResult update(long id, CommonParam saveIn);

    /**
     * 逻辑删除一条引用数据类型。
     *
     * @param id 数据库生成主键，例如 {@code 2}
     * @return 删除结果，例如
     *     {@code {"success":true,"data":{"id":2,"status":0},"affectedRows":1,"msg":"类型删除完成。"}}
     */
    CommonResult delete(long id);
}
