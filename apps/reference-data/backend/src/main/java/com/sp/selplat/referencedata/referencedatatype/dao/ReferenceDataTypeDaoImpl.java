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

    /**
     * 分页查询类型目录，并根据真实树节点表与选项表聚合每个类型的数据库分类。
     *
     * @param keyword 稳定坐标或多语名称关键词，例如 {@code "resource-kind"}
     * @param status 类型状态，例如 {@code 1}；查询全部未删除类型时为 {@code null}
     * @param pageNo 一基页码，例如 {@code 1}
     * @param pageSize 每页条数，例如 {@code 20}
     * @return 数据库排序与分类已聚合的分页结果，例如
     *     {@code {"records":[{"resourceCode":"resource-kind","resourceKinds":["TREE","OPTIONS"]}],"totalCount":1}}
     * @throws CommonSystemException 分页、树节点分类或选项分类查询失败时抛出，例如数据库连接中断
     */
    @Override
    public CommonPageResult findPage(String keyword, Integer status, int pageNo, int pageSize) {
        try {
            StringBuilder whereSql = new StringBuilder(" WHERE t.status <> 0");
            List<Object> parameters = new ArrayList<>();
            if (keyword != null && !keyword.isBlank()) {
                whereSql.append(" AND (LOWER(t.projectCode) LIKE ? OR LOWER(t.resourceCode) LIKE ?")
                        .append(" OR LOWER(t.nameZh) LIKE ? OR LOWER(t.nameJa) LIKE ? OR LOWER(t.nameEn) LIKE ?)");
                String pattern = "%" + keyword.trim().toLowerCase() + "%";
                for (int index = 0; index < 5; index++) {
                    parameters.add(pattern);
                }
            }
            if (status != null) {
                whereSql.append(" AND t.status = ?");
                parameters.add(status);
            }
            Long totalCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataType t" + whereSql,
                    Long.class,
                    parameters.toArray());
            List<Object> pageParameters = new ArrayList<>(parameters);
            pageParameters.add(pageSize);
            pageParameters.add((pageNo - 1) * pageSize);
            // 类型主键 → 两张真实数据表中的存在性，不恢复已退役的 dataShape 字段。
            List<Map<String, Object>> records = jdbc.queryForList(
                    "SELECT t.*, "
                            + "EXISTS (SELECT 1 FROM ReferenceDataTreeNode treeData "
                            + "WHERE treeData.typeId = t.id AND treeData.status <> 0) AS hasTreeNodes, "
                            + "EXISTS (SELECT 1 FROM ReferenceDataOption optionData "
                            + "WHERE optionData.typeId = t.id AND optionData.status <> 0) AS hasOptions "
                            + "FROM ReferenceDataType t" + whereSql
                            + " ORDER BY t.sortnum DESC, t.id ASC LIMIT ? OFFSET ?",
                    pageParameters.toArray());
            // 查询存在性 → 页面可直接消费的多值分类；同一类型可同时归入 TREE 和 OPTIONS。
            records.forEach(record -> {
                List<String> resourceKinds = new ArrayList<>();
                if (Boolean.TRUE.equals(record.remove("hasTreeNodes"))) {
                    resourceKinds.add("TREE");
                }
                if (Boolean.TRUE.equals(record.remove("hasOptions"))) {
                    resourceKinds.add("OPTIONS");
                }
                record.put("resourceKinds", List.copyOf(resourceKinds));
            });
            CommonPageResult result = new CommonPageResult();
            result.setRecords(records);
            // COUNT(*) 对成功查询固定返回一行非空数值，直接保留数据库统计结果。
            result.setTotalCount(totalCount);
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
            // COUNT(*) 成功时固定非空，正数表示稳定坐标已被占用。
            return count > 0;
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    /**
     * 把类型分页或坐标查询产生的数据库技术故障转换为统一系统异常。
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
