package com.sp.selplat.referencedata.referencedataoption.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 使用 reference-data 私有数据库读取 ReferenceDataOption 表。 */
@Repository
public class ReferenceDataOptionDaoImpl extends ReferenceDataBaseDao implements ReferenceDataOptionDao {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 创建下拉选项 DAO。
     *
     * @param jdbcTemplate 限定到 reference-data 数据库的模板，例如连接 {@code reference-data.mv.db}
     */
    public ReferenceDataOptionDaoImpl(
            @Qualifier("referenceDataJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * 按类型的项目与资源坐标查询启用选项。
     *
     * @param projectCode 类型所属项目，例如 {@code "reference-data"}
     * @param resourceCode 项目内资源编码，例如 {@code "resource-kind"}
     * @return 按排序值和主键升序的选项记录，例如 {@code [{optionValue:"TREE"}]}
     * 异常或副作用示例：坐标未命中时返回空列表，查询不会修改数据库。
     */
    @Override
    public List<Map<String, Object>> findEnabledOptions(String projectCode, String resourceCode) {
        return jdbcTemplate.queryForList(
                "SELECT o.optionValue AS \"optionValue\", o.labelZh AS \"labelZh\", "
                        + "o.labelJa AS \"labelJa\", o.labelEn AS \"labelEn\", "
                        + "o.groupCode AS \"groupCode\", o.sortnum AS \"sortnum\", "
                        + "o.disabled AS \"disabled\", o.attributesJson AS \"attributesJson\" "
                        + "FROM ReferenceDataOption o JOIN ReferenceDataType t ON t.id = o.typeId "
                        + "WHERE t.projectCode = ? AND t.resourceCode = ? "
                        + "AND t.status = 1 AND o.status = 1 ORDER BY o.sortnum ASC, o.id ASC",
                projectCode,
                resourceCode);
    }

    /**
     * 从页面控件绑定出发查询当前下拉框的启用选项。
     *
     * @param tenantId 当前租户主键，例如 {@code 1L}
     * @param pageProjectCode 控件所在项目编码，例如 {@code "cms"}
     * @param pagePath 控件所在页面路径，例如 {@code "/cms/article.html"}
     * @param controlId 页面内稳定控件 ID，例如 {@code "selDropdownArticleStatusId"}
     * @return 按排序值和主键升序的选项记录，例如 {@code [{optionValue:"DRAFT"}]}
     * 异常或副作用示例：绑定被停用、类型被停用或选项被停用时均不返回对应记录。
     */
    @Override
    public List<Map<String, Object>> findEnabledOptionsByControl(
            Long tenantId,
            String pageProjectCode,
            String pagePath,
            String controlId) {
        // 页面控件绑定、类型和选项一次联查，调用方不再先查 typeId 再拼第二个请求。
        return jdbcTemplate.queryForList(
                "SELECT o.optionValue AS \"optionValue\", o.labelZh AS \"labelZh\", "
                        + "o.labelJa AS \"labelJa\", o.labelEn AS \"labelEn\", "
                        + "o.groupCode AS \"groupCode\", o.sortnum AS \"sortnum\", "
                        + "o.disabled AS \"disabled\", o.attributesJson AS \"attributesJson\" "
                        + "FROM ReferenceDataControlBinding b "
                        + "JOIN ReferenceDataType t ON t.id = b.typeId AND t.tenantId = b.tenantId "
                        + "JOIN ReferenceDataOption o ON o.typeId = t.id AND o.tenantId = b.tenantId "
                        + "WHERE b.tenantId = ? AND b.pageProjectCode = ? AND b.pagePath = ? "
                        + "AND b.controlId = ? AND b.controlType = 'DROPDOWN' "
                        + "AND b.status = 1 AND t.status = 1 AND o.status = 1 "
                        + "ORDER BY o.sortnum ASC, o.id ASC",
                tenantId,
                pageProjectCode,
                pagePath,
                controlId);
    }
}
