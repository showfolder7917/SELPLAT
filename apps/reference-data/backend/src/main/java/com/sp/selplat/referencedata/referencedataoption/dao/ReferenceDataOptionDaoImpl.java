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

    /** {@inheritDoc} */
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
}
