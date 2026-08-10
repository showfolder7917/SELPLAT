package com.sp.selplat.referencedata.referencedatatreenode.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 使用 reference-data 私有数据库读取 ReferenceDataTreeNode 表。 */
@Repository
public class ReferenceDataTreeNodeDaoImpl extends ReferenceDataBaseDao implements ReferenceDataTreeNodeDao {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 创建树节点 DAO。
     *
     * @param jdbcTemplate 限定到 reference-data 数据库的模板，例如连接 {@code reference-data.mv.db}
     */
    public ReferenceDataTreeNodeDaoImpl(
            @Qualifier("referenceDataJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findEnabledNodes(String projectCode, String resourceCode) {
        return jdbcTemplate.queryForList(
                "SELECT n.nodeCode AS \"nodeCode\", p.nodeCode AS \"parentCode\", "
                        + "n.nodeValue AS \"nodeValue\", n.labelZh AS \"labelZh\", "
                        + "n.labelJa AS \"labelJa\", n.labelEn AS \"labelEn\", "
                        + "n.attributesJson AS \"attributesJson\" "
                        + "FROM ReferenceDataTreeNode n "
                        + "JOIN ReferenceDataType t ON t.id = n.typeId "
                        + "LEFT JOIN ReferenceDataTreeNode p ON p.id = n.parentId "
                        + "WHERE t.projectCode = ? AND t.resourceCode = ? "
                        + "AND t.status = 1 AND n.status = 1 "
                        + "ORDER BY n.sortnum ASC, n.id ASC",
                projectCode,
                resourceCode);
    }
}
