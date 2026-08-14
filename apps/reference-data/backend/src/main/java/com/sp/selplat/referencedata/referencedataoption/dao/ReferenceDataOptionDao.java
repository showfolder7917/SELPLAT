package com.sp.selplat.referencedata.referencedataoption.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 负责从 ReferenceDataOption 表读取一个已登记资源的启用选项。 */
public interface ReferenceDataOptionDao extends BaseDao {

    /**
     * 按项目与资源坐标查询下拉选项。
     *
     * @param projectCode 类型所属项目，例如 {@code "reference-data"}
     * @param resourceCode 项目内资源编码，例如 {@code "resource-kind"}
     * @return 选项记录，例如 {@code [{optionValue:"TREE",labelZh:"树形资源"}]}
     */
    List<Map<String, Object>> findEnabledOptions(String projectCode, String resourceCode);

    /**
     * 按页面控件唯一坐标查询其绑定类型下的启用选项。
     *
     * @param tenantId 当前租户主键，例如 {@code 1L}
     * @param pageProjectCode 控件所在项目编码，例如 {@code "cms"}
     * @param pagePath 控件所在页面路径，例如 {@code "/cms/article.html"}
     * @param controlId 页面内稳定控件 ID，例如 {@code "selDropdownArticleStatusId"}
     * @return 选项记录，例如 {@code [{optionValue:"PUBLISHED",labelZh:"已发布"}]}
     * 异常或副作用示例：坐标没有启用绑定时返回空列表，不修改绑定或选项数据。
     */
    List<Map<String, Object>> findEnabledOptionsByControl(
            Long tenantId,
            String pageProjectCode,
            String pagePath,
            String controlId);
}
