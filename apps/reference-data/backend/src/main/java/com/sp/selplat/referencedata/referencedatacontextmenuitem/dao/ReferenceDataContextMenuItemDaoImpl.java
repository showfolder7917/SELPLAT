package com.sp.selplat.referencedata.referencedatacontextmenuitem.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 使用 reference-data 私有数据库读取 ReferenceDataContextMenuItem 表。 */
@Repository
public class ReferenceDataContextMenuItemDaoImpl
        extends ReferenceDataBaseDao
        implements ReferenceDataContextMenuItemDao {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 创建右键菜单 DAO。
     *
     * @param jdbcTemplate 限定到 reference-data 数据库的模板，例如连接 {@code reference-data.mv.db}
     */
    public ReferenceDataContextMenuItemDaoImpl(
            @Qualifier("referenceDataJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findEnabledMenuItems(String projectCode, String resourceCode) {
        return jdbcTemplate.queryForList(
                "SELECT m.itemCode AS \"itemCode\", p.itemCode AS \"parentCode\", "
                        + "m.labelZh AS \"labelZh\", m.labelJa AS \"labelJa\", "
                        + "m.labelEn AS \"labelEn\", m.icon AS \"icon\", "
                        + "m.command AS \"command\", m.disabled AS \"disabled\", "
                        + "m.attributesJson AS \"attributesJson\" "
                        + "FROM ReferenceDataContextMenuItem m "
                        + "JOIN ReferenceDataType t ON t.id = m.typeId "
                        + "LEFT JOIN ReferenceDataContextMenuItem p ON p.id = m.parentId "
                        + "WHERE t.projectCode = ? AND t.resourceCode = ? "
                        + "AND t.status = 1 AND m.status = 1 ORDER BY m.sortnum ASC, m.id ASC",
                projectCode,
                resourceCode);
    }
}
