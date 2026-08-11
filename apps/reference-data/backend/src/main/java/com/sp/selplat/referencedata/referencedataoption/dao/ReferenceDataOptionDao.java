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
}
