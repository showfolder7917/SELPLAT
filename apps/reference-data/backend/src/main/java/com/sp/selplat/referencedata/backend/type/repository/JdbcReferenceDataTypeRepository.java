package com.sp.selplat.referencedata.backend.type.repository;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.referencedata.backend.persistence.ReferenceDataDatabase;
import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * 使用 reference-data 独立数据库实现类型目录聚合仓储。
 * SQL 的表名、字段名和排序全部由本类固定，前端只能传递值参数。
 */
@Repository
public class JdbcReferenceDataTypeRepository implements ReferenceDataTypeRepository {

    // SELECT_COLUMNS 固定管理端允许读取的类型字段，避免列表与详情返回结构漂移。
    private static final String SELECT_COLUMNS = "id, projectCode, resourceCode, nameZh, nameJa, nameEn, "
            + "descriptionZh, descriptionJa, descriptionEn, dataShape, status, sortnum, createdAt, updatedAt";
    // database 保存独立 JDBC 和事务上下文，Repository 不会误用 Host 主数据库。
    private final ReferenceDataDatabase database;

    /**
     * 装配引用数据类型仓储。
     *
     * @param database reference-data 独立数据库上下文
     * 执行结果示例：所有 SQL 均连接 {@code apps/reference-data/db/data/reference-data} 或隔离测试库。
     */
    public JdbcReferenceDataTypeRepository(ReferenceDataDatabase database) {
        // 独立数据库上下文 → 当前类型目录全部查询与写入入口。
        this.database = database;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonPageResult findPage(String keyword, Integer status, int pageNo, int pageSize) {
        try {
            // 固定基础条件排除逻辑删除记录，管理页仍可筛选启用与停用状态。
            StringBuilder whereSql = new StringBuilder(" WHERE status <> 0");
            List<Object> parameters = new ArrayList<>();
            // 关键词同时匹配稳定坐标和三语名称，所有值均使用 JDBC 占位符。
            if (keyword != null && !keyword.isBlank()) {
                whereSql.append(" AND (LOWER(projectCode) LIKE ? OR LOWER(resourceCode) LIKE ?")
                        .append(" OR LOWER(nameZh) LIKE ? OR LOWER(nameJa) LIKE ? OR LOWER(nameEn) LIKE ?)");
                String keywordPattern = "%" + keyword.trim().toLowerCase() + "%";
                for (int index = 0; index < 5; index++) {
                    // 同一安全关键词值 → 五个允许检索的固定字段。
                    parameters.add(keywordPattern);
                }
            }
            // 合法状态值由 Service 校验后传入，Repository 只追加等值条件。
            if (status != null) {
                whereSql.append(" AND status = ?");
                parameters.add(status);
            }
            JdbcTemplate jdbcTemplate = database.jdbcTemplate();
            // 先查询真实总数 → 分页组件不依赖当前页记录数量猜测总数。
            Long totalCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataType" + whereSql,
                    Long.class,
                    parameters.toArray());
            // 固定按业务排序倒序和主键升序，分页结果在重启后保持稳定。
            String pageSql = "SELECT " + SELECT_COLUMNS + " FROM ReferenceDataType" + whereSql
                    + " ORDER BY sortnum DESC, id ASC LIMIT ? OFFSET ?";
            List<Object> pageParameters = new ArrayList<>(parameters);
            pageParameters.add(pageSize);
            pageParameters.add((pageNo - 1) * pageSize);
            // 当前页 SQL → 有序类型记录映射。
            List<Map<String, Object>> records = jdbcTemplate.query(
                    pageSql,
                    (resultSet, rowNumber) -> mapRecord(resultSet),
                    pageParameters.toArray());
            // 数据库记录与总数 → 公共唯一分页返回结构。
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

    /**
     * {@inheritDoc}
     */
    @Override
    public Map<String, Object> findById(long id) {
        try {
            // 主键与未删除条件 → 唯一类型详情。
            return database.jdbcTemplate().queryForObject(
                    "SELECT " + SELECT_COLUMNS + " FROM ReferenceDataType WHERE id = ? AND status <> 0",
                    (resultSet, rowNumber) -> mapRecord(resultSet),
                    id);
        } catch (EmptyResultDataAccessException exception) {
            // 未命中属于正常业务事实，由 Service 转换成业务异常。
            return null;
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public boolean existsCoordinate(String projectCode, String resourceCode, Long excludedId) {
        try {
            // 更新时排除当前记录；新增时直接检查全部未删除记录。
            String sql = "SELECT COUNT(*) FROM ReferenceDataType "
                    + "WHERE projectCode = ? AND resourceCode = ? AND status <> 0";
            List<Object> parameters = new ArrayList<>(List.of(projectCode, resourceCode));
            if (excludedId != null) {
                sql += " AND id <> ?";
                parameters.add(excludedId);
            }
            Integer count = database.jdbcTemplate().queryForObject(sql, Integer.class, parameters.toArray());
            // 至少存在一条未删除坐标 → 当前业务坐标不可再次使用。
            return count != null && count > 0;
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public long insert(Map<String, Object> values) {
        try {
            // 数据库 identity 负责生成业务表主键，Java 不计算 max(id)+1。
            KeyHolder keyHolder = new GeneratedKeyHolder();
            database.jdbcTemplate().update(connection -> {
                PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO ReferenceDataType (projectCode, resourceCode, nameZh, nameJa, nameEn, "
                                + "descriptionZh, descriptionJa, descriptionEn, dataShape, status, sortnum) "
                                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        new String[] {"id"});
                // Service 已校验字段按固定数据库列顺序绑定，禁止 Map 键参与 SQL 拼接。
                statement.setObject(1, values.get("projectCode"));
                statement.setObject(2, values.get("resourceCode"));
                statement.setObject(3, values.get("nameZh"));
                statement.setObject(4, values.get("nameJa"));
                statement.setObject(5, values.get("nameEn"));
                statement.setObject(6, values.get("descriptionZh"));
                statement.setObject(7, values.get("descriptionJa"));
                statement.setObject(8, values.get("descriptionEn"));
                statement.setObject(9, values.get("dataShape"));
                statement.setObject(10, values.get("status"));
                statement.setObject(11, values.get("sortnum"));
                return statement;
            }, keyHolder);
            Number generatedId = keyHolder.getKey();
            if (generatedId == null) {
                throw new IllegalStateException("reference-data type generated id is missing");
            }
            // 数据库回填主键 → 新增后详情查询入口。
            return generatedId.longValue();
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public int update(long id, Map<String, Object> values) {
        try {
            // 全部可编辑字段按稳定列集合更新，数据库自动刷新最后修改时间。
            return database.jdbcTemplate().update(
                    "UPDATE ReferenceDataType SET projectCode = ?, resourceCode = ?, nameZh = ?, nameJa = ?, "
                            + "nameEn = ?, descriptionZh = ?, descriptionJa = ?, descriptionEn = ?, "
                            + "dataShape = ?, status = ?, sortnum = ?, updatedAt = CURRENT_TIMESTAMP "
                            + "WHERE id = ? AND status <> 0",
                    values.get("projectCode"),
                    values.get("resourceCode"),
                    values.get("nameZh"),
                    values.get("nameJa"),
                    values.get("nameEn"),
                    values.get("descriptionZh"),
                    values.get("descriptionJa"),
                    values.get("descriptionEn"),
                    values.get("dataShape"),
                    values.get("status"),
                    values.get("sortnum"),
                    id);
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public int softDelete(long id) {
        try {
            // 删除固定表示状态归零，正式类型及其历史数据不会被物理移除。
            return database.jdbcTemplate().update(
                    "UPDATE ReferenceDataType SET status = 0, updatedAt = CURRENT_TIMESTAMP "
                            + "WHERE id = ? AND status <> 0",
                    id);
        } catch (DataAccessException exception) {
            throw databaseFailure(exception);
        }
    }

    /**
     * 把当前结果行转换为管理 API 的稳定字段映射。
     *
     * @param resultSet JDBC 当前类型记录
     * @return 完整类型结构，例如
     *     {@code {"id":1,"projectCode":"reference-data","resourceCode":"resource-kind","status":1}}
     * @throws java.sql.SQLException 当 JDBC 无法读取固定字段时抛出并由 Spring 转换为数据访问异常
     */
    private Map<String, Object> mapRecord(java.sql.ResultSet resultSet) throws java.sql.SQLException {
        // 数据库固定列 → 保持前端字段顺序的类型对象。
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", resultSet.getLong("id"));
        record.put("projectCode", resultSet.getString("projectCode"));
        record.put("resourceCode", resultSet.getString("resourceCode"));
        record.put("nameZh", resultSet.getString("nameZh"));
        record.put("nameJa", resultSet.getString("nameJa"));
        record.put("nameEn", resultSet.getString("nameEn"));
        record.put("descriptionZh", resultSet.getString("descriptionZh"));
        record.put("descriptionJa", resultSet.getString("descriptionJa"));
        record.put("descriptionEn", resultSet.getString("descriptionEn"));
        record.put("dataShape", resultSet.getString("dataShape"));
        record.put("status", resultSet.getInt("status"));
        record.put("sortnum", resultSet.getBigDecimal("sortnum"));
        record.put("createdAt", resultSet.getTimestamp("createdAt").toLocalDateTime());
        record.put("updatedAt", resultSet.getTimestamp("updatedAt").toLocalDateTime());
        return record;
    }

    /**
     * 把数据库技术失败转换为平台统一系统异常。
     *
     * @param cause Spring JDBC 保留的原始数据访问异常
     * @return 稳定系统异常，例如
     *     {@code CommonSystemException("REFERENCE_DATA_DATABASE_FAILED", "引用数据数据库操作失败。", cause)}
     */
    private CommonSystemException databaseFailure(DataAccessException cause) {
        // JDBC 技术异常 → 对外安全消息与可追踪原始原因。
        return new CommonSystemException(
                "REFERENCE_DATA_DATABASE_FAILED",
                "引用数据数据库操作失败。",
                cause);
    }
}
