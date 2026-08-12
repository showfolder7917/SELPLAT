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

    /** {@inheritDoc} */
    @Override
    public int updateColumnWidths(
            String tableName,
            String gridId,
            Map<String, String> columnWidths,
            Long tenantId,
            Long operatorId) {
        // 每列使用同一稳定坐标和当前服务端身份更新，前端无法借列宽保存改写其他租户数据。
        int affectedRows = 0;
        for (Map.Entry<String, String> columnWidth : columnWidths.entrySet()) {
            affectedRows += jdbcTemplate.update(
                    "UPDATE ReferenceDataTableColumn SET width = ?, lastOperateUserId = ?, "
                            + "updatedAt = CURRENT_TIMESTAMP WHERE tenantId = ? AND tableName = ? "
                            + "AND gridId = ? AND gridColumnId = ? AND status <> 0",
                    columnWidth.getValue(),
                    operatorId,
                    tenantId,
                    tableName,
                    gridId,
                    columnWidth.getKey());
        }
        // 返回全部语句累计影响行数，Service 据此阻断不存在或不属于当前租户的坐标。
        return affectedRows;
    }
}
