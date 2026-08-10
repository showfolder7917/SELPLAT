package com.sp.selplat.referencedata.referencedatatype.dao;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 复用公共 Base DAO 管理 ReferenceDataType，只实现跨字段关键词和坐标唯一性查询。
 */
@Repository
public class ReferenceDataTypeDaoImpl extends ReferenceDataBaseDao implements ReferenceDataTypeDao {

    private final JdbcTemplate jdbc;

    /**
     * 创建只访问 reference-data 私有数据库的类型 DAO。
     *
     * @param jdbcTemplate 按限定名注入的 reference-data JDBC 模板，例如连接
     *     {@code apps/reference-data/db/reference-data}
     */
    public ReferenceDataTypeDaoImpl(
            @Qualifier("referenceDataJdbcTemplate") JdbcTemplate jdbcTemplate) {
        // 模块私有模板 → 自定义分页与唯一性查询均进入 reference-data 数据库。
        this.jdbc = jdbcTemplate;
    }

    @Override
    public CommonPageResult findPage(String keyword, Integer status, int pageNo, int pageSize) {
        try {
            StringBuilder whereSql = new StringBuilder(" WHERE status <> 0");
            List<Object> parameters = new ArrayList<>();
            if (keyword != null && !keyword.isBlank()) {
                whereSql.append(" AND (LOWER(projectCode) LIKE ? OR LOWER(resourceCode) LIKE ?")
                        .append(" OR LOWER(nameZh) LIKE ? OR LOWER(nameJa) LIKE ? OR LOWER(nameEn) LIKE ?)");
                String pattern = "%" + keyword.trim().toLowerCase() + "%";
                for (int index = 0; index < 5; index++) {
                    parameters.add(pattern);
                }
            }
            if (status != null) {
                whereSql.append(" AND status = ?");
                parameters.add(status);
            }
            Long totalCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataType" + whereSql,
                    Long.class,
                    parameters.toArray());
            List<Object> pageParameters = new ArrayList<>(parameters);
            pageParameters.add(pageSize);
            pageParameters.add((pageNo - 1) * pageSize);
            List<Map<String, Object>> records = jdbc.queryForList(
                    "SELECT * FROM ReferenceDataType" + whereSql
                            + " ORDER BY sortnum DESC, id ASC LIMIT ? OFFSET ?",
                    pageParameters.toArray());
            CommonPageResult result = new CommonPageResult();
            result.setRecords(records);
            result.setTotalCount(totalCount == null ? 0 : totalCount);
            result.setPageNo(pageNo);
            result.setPageSize(pageSize);
            return result;
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    @Override
    public boolean existsCoordinate(String projectCode, String resourceCode, Long excludedId) {
        try {
            String sql = "SELECT COUNT(*) FROM ReferenceDataType "
                    + "WHERE projectCode = ? AND resourceCode = ? AND status <> 0";
            List<Object> parameters = new ArrayList<>(List.of(projectCode, resourceCode));
            if (excludedId != null) {
                sql += " AND id <> ?";
                parameters.add(excludedId);
            }
            Integer count = jdbc.queryForObject(sql, Integer.class, parameters.toArray());
            return count != null && count > 0;
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    private CommonSystemException databaseFailure(DataAccessException cause) {
        return new CommonSystemException(
                "REFERENCE_DATA_DATABASE_FAILED",
                "引用数据数据库操作失败。",
                cause);
    }
}
