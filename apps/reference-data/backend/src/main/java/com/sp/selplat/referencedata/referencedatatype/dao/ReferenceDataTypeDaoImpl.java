package com.sp.selplat.referencedata.referencedatatype.dao;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 复用公共 Base DAO 管理 ReferenceDataType，只实现受控关键词和选项组值唯一性查询。
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
    public boolean existsOptionSetValue(
            long tenantId, String optionSetCode, String valueCode, Long excludedId) {
        try {
            String sql = "SELECT COUNT(*) FROM ReferenceDataType "
                    + "WHERE tenantId=? AND optionSetCode=? AND valueCode=?";
            List<Object> parameters = new ArrayList<>(List.of(tenantId, optionSetCode, valueCode));
            if (excludedId != null) {
                sql += " AND id <> ?";
                parameters.add(excludedId);
            }
            Integer count = jdbc.queryForObject(sql, Integer.class, parameters.toArray());
            // COUNT(*) 成功时固定非空，正数表示分类编码已被占用。
            return count > 0;
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> findEnabledByCode(String typeCode) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT * FROM ReferenceDataType WHERE code = ? AND status = 1",
                    typeCode);
            return rows.isEmpty() ? null : rows.get(0);
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    /**
     * 把类型分页或分类查询产生的数据库技术故障转换为统一系统异常。
     *
     * @param cause JDBC 或 H2 产生的真实数据访问异常，例如目标表不存在
     * @return 系统异常，例如
     *     {@code CommonSystemException("REFERENCE_DATA_DATABASE_FAILED", "引用数据数据库操作失败。", cause)}
     */
    private CommonSystemException databaseFailure(DataAccessException cause) {
        return new CommonSystemException(
                "REFERENCE_DATA_DATABASE_FAILED",
                "引用数据数据库操作失败。",
                cause);
    }
}
