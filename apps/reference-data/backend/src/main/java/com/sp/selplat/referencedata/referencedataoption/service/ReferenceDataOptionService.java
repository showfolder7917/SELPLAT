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

    /**
     * 查询一个页面下拉框通过数据库绑定得到的选项。
     *
     * @param pageProjectCode 控件所在项目编码，例如 {@code "cms"}
     * @param pagePath 控件所在页面路径，例如 {@code "/cms/article.html"}
     * @param controlId 页面内稳定控件 ID，例如 {@code "selDropdownArticleStatusId"}
     * @param parameters URL 参数，例如 {@code {"locale":"zh-CN"}}
     * @return 选项结果，例如 {@code {"success":true,"data":[{"value":"DRAFT"}]}}
     * 异常或副作用示例：控件没有启用绑定或绑定类型没有选项时抛出可展示业务异常。
     */
    CommonResult getOptionsByControl(
            String pageProjectCode,
            String pagePath,
            String controlId,
            Map<String, String> parameters);
}
