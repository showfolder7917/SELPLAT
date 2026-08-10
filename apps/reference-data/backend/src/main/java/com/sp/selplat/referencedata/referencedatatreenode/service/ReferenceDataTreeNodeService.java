package com.sp.selplat.referencedata.referencedatatreenode.service;

import com.sp.selplat.common.util.CommonResult;
import java.util.Map;

/** 声明 ReferenceDataTreeNode 表的树查询业务。 */
public interface ReferenceDataTreeNodeService {

    /**
     * 查询一个资源的完整树。
     *
     * @param projectCode URL 项目编码，例如 {@code "reference-data"}
     * @param resourceCode URL 资源编码，例如 {@code "resource-kind"}
     * @param parameters URL 参数，例如 {@code {"locale":"en-US"}}
     * @return 树结果，例如 {@code {"success":true,"data":[{"id":"resource-kind-root"}]}}
     */
    CommonResult getTree(String projectCode, String resourceCode, Map<String, String> parameters);
}
