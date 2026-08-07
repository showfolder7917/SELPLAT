package com.sp.selplat.referencedata.backend.referencedatatype.dao;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.referencedata.backend.common.persistence.ReferenceDataBaseDao;
import com.sp.selplat.referencedata.backend.common.persistence.ReferenceDataDatabase;
import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * 复用公共 Base DAO 管理 ReferenceDataType，只实现跨字段关键词、坐标唯一性和 identity 回填。
 */
@Repository
public class ReferenceDataTypeDaoImpl extends ReferenceDataBaseDao implements ReferenceDataTypeDao {

    private final JdbcTemplate jdbc;

    public ReferenceDataTypeDaoImpl(ReferenceDataDatabase database) {
        this.jdbc = database.jdbcTemplate();
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

    @Override
    public long insertReturningId(CommonParam saveIn) {
        try {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO ReferenceDataType (projectCode, resourceCode, nameZh, nameJa, nameEn, "
                                + "descriptionZh, descriptionJa, descriptionEn, status, sortnum) "
                                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        new String[] {"id"});
                statement.setObject(1, saveIn.getParam("projectCode"));
                statement.setObject(2, saveIn.getParam("resourceCode"));
                statement.setObject(3, saveIn.getParam("nameZh"));
                statement.setObject(4, saveIn.getParam("nameJa"));
                statement.setObject(5, saveIn.getParam("nameEn"));
                statement.setObject(6, saveIn.getParam("descriptionZh"));
                statement.setObject(7, saveIn.getParam("descriptionJa"));
                statement.setObject(8, saveIn.getParam("descriptionEn"));
                statement.setObject(9, saveIn.getParam("status"));
                statement.setObject(10, saveIn.getParam("sortnum"));
                return statement;
            }, keyHolder);
            Number generatedId = keyHolder.getKey();
            if (generatedId == null) {
                throw new IllegalStateException("reference-data type generated id is missing");
            }
            return generatedId.longValue();
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
