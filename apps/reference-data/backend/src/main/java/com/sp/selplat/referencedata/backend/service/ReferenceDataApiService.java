package com.sp.selplat.referencedata.backend.service;

import com.sp.selplat.common.util.CommonResult;
import java.util.Map;

/**
 * 定义 reference-data HTTP 层使用的结果编排契约。
 * 本接口把路径和查询参数转换成内部查询对象，并构建固定 CommonResult；Controller 只负责 JSON 序列化。
 */
public interface ReferenceDataApiService {

    /**
     * 查询树资源并构建统一成功结果。
     *
     * @param projectCode URL 路径中的项目编码，例如 {@code "reference-data"}
     * @param resourceCode URL 路径中的资源编码，例如 {@code "resource-kind"}
     * @param tenantId 请求参数中的租户标识，例如 {@code "10001"}；平台资源可以为空
     * @param parameters URL 查询参数，例如 {@code {"locale":"en-US"}}
     * @return 固定结果，例如
     *     {@code {"success":true,"moduleCode":"reference-data","data":[{"id":"resource-kind-root"}],"msg":"引用数据树查询完成。"}}
     */
    CommonResult getTree(
            String projectCode,
            String resourceCode,
            String tenantId,
            Map<String, String> parameters);

    /**
     * 查询类型选项并构建统一成功结果。
     *
     * @param projectCode URL 路径中的项目编码，例如 {@code "reference-data"}
     * @param resourceCode URL 路径中的资源编码，例如 {@code "resource-kind"}
     * @param tenantId 请求参数中的租户标识，例如 {@code "10001"}；平台资源可以为空
     * @param parameters URL 查询参数，例如 {@code {"locale":"ja-JP"}}
     * @return 固定结果，例如
     *     {@code {"success":true,"moduleCode":"reference-data","data":[{"value":"TREE","label":"ツリーリソース"}],"msg":"引用数据选项查询完成。"}}
     */
    CommonResult getOptions(
            String projectCode,
            String resourceCode,
            String tenantId,
            Map<String, String> parameters);
}
