package com.sp.selplat.referencedata.referencedatatablecolumn.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 使用 reference-data 私有数据库维护并解析页面表格头配置。 */
@Repository
public class ReferenceDataTableColumnDaoImpl
        extends ReferenceDataBaseDao
        implements ReferenceDataTableColumnDao {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 创建表格头配置 DAO。
     *
     * @param jdbcTemplate 限定到 reference-data 数据库的模板，例如连接 {@code reference-data.mv.db}
     * 执行结果示例：后续查询只命中 ReferenceDataTableColumn，不访问 Host 其他数据源。
     */
    public ReferenceDataTableColumnDaoImpl(
            @Qualifier("referenceDataJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findVisibleColumns(String tableName, String gridId) {
        // 稳定表名与 SEL 表格实例标识只作为绑定参数 → 不参与 SQL 标识符拼接。
        return jdbcTemplate.queryForList(
                "SELECT gridColumnId AS \"gridColumnId\", tableFieldName AS \"tableFieldName\", "
                        + "tableSecondaryFieldName AS \"tableSecondaryFieldName\", labelZh AS \"labelZh\", "
                        + "labelJa AS \"labelJa\", labelEn AS \"labelEn\", width AS \"width\", "
                        + "cellRenderer AS \"cellRenderer\", cellIcon AS \"cellIcon\", "
                        + "cellIconVisible AS \"cellIconVisible\", sortnum AS \"sortnum\" "
                        + "FROM ReferenceDataTableColumn WHERE tableName = ? AND gridId = ? "
                        + "AND status = 1 AND visible = TRUE ORDER BY sortnum ASC, id ASC",
                tableName,
                gridId);
    }
}
