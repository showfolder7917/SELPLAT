package com.sp.selplat.referencedata.referencedataoption.service;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.service.BaseService;
import java.util.Map;

/** 声明 ReferenceDataOption 表的下拉查询业务。 */
public interface ReferenceDataOptionService extends BaseService {

    /**
     * 查询一个资源的下拉选项。
     *
     * @param projectCode URL 项目编码，例如 {@code "reference-data"}
     * @param resourceCode URL 资源编码，例如 {@code "resource-kind"}
     * @param parameters URL 参数，例如 {@code {"locale":"ja-JP"}}
     * @return 选项结果，例如 {@code {"success":true,"data":[{"value":"TREE"}]}}
     */
    CommonResult getOptions(String projectCode, String resourceCode, Map<String, String> parameters);
}
