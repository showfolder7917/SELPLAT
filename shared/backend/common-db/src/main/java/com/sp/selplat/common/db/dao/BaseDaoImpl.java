package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.query.model.QueryCondition;
import com.sp.selplat.common.db.query.model.QueryOrder;
import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import com.sp.selplat.common.db.template.model.CommonTemplateSave;
import com.sp.selplat.common.db.template.model.CommonTemplateUpdate;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageResult;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * BaseDaoImpl 与 BaseDao 一一对应，集中实现业务模块允许调用的全部分页、查询、新增、更新和假删除能力。
 */
public abstract class BaseDaoImpl extends BaseCrudDaoImpl implements BaseDao {

    // BATCH_OPERATION_SIZE 固定每次交给底层批处理的最大记录数，避免超大请求一次占满数据库参数和内存。
    private static final int BATCH_OPERATION_SIZE = 1000;
    // SOFT_DELETE_STATUS_COLUMN 固定平台逻辑删除状态字段，供遵循公共审计列约定的业务表复用。
    private static final String SOFT_DELETE_STATUS_COLUMN = "status";
    // SOFT_DELETE_UPDATED_AT_COLUMN 固定最后更新时间字段，保证公共假删除动作留下变更时间。
    private static final String SOFT_DELETE_UPDATED_AT_COLUMN = "updatedAt";
    // SOFT_DELETED_STATUS_VALUE 固定逻辑删除状态值，避免各业务 DAO 重复维护相同约定。
    private static final int SOFT_DELETED_STATUS_VALUE = 0;

    /**
     * 根据当前 DAO 的表名和主键元数据生成发号定义，具体组装由支撑层完成。
     *
     * @return 主键字段到号段编码的定义，例如 {@code {"id":"UniauthUserId"}}
     */
    @Override
    public IdSequenceDefinition getIdSequenceDefinition() {
        // 委托支撑层根据当前 DAO 的表名和主键元数据生成字段到独立号段编码的定义。
        return buildIdSequenceDefinition();
    }

    /**
     * 按动态条件和默认 {@code sortnum desc} 排序查询当前页。
     *
     * @param queryColumnValueMap 前端查询字段，例如 {@code {"status":1,"loginNameLike":"admin"}}
     * @param pageNo 当前页码，例如 {@code 1}
     * @param pageSize 每页条数，例如 {@code 10}
     * @return 分页结果，例如 {@code {"records":[{"id":1}],"totalCount":1,"pageNo":1,"pageSize":10}}
     */
    @Override
    public CommonPageResult getPageList(Map<String, Object> queryColumnValueMap, Integer pageNo, Integer pageSize) {
        // 默认按 sortnum 倒序查询，保持简单主数据列表的统一展示顺序。
        return getPageList(queryColumnValueMap, "sortnum desc", pageNo, pageSize);
    }

    /**
     * 按动态条件和调用方选择的受控排序查询当前页。
     *
     * @param queryColumnValueMap 前端查询字段，例如 {@code {"status":1}}
     * @param orderBy 受控排序表达式，例如 {@code "sortnum desc id asc"}
     * @param pageNo 当前页码，例如 {@code 1}
     * @param pageSize 每页条数，例如 {@code 10}
     * @return 排序后的分页结果，例如 {@code {"records":[{"id":2},{"id":1}],"totalCount":2}}
     */
    @Override
    public CommonPageResult getPageList(Map<String, Object> queryColumnValueMap, String orderBy, Integer pageNo, Integer pageSize) {
        // 把字段后缀驱动的查询条件转换成结构化条件集合，继续复用分页层内部解析能力。
        List<QueryCondition> conditions = buildQueryConditions(queryColumnValueMap);
        // 把排序字符串转换成结构化排序集合，继续复用分页层内部解析能力。
        List<QueryOrder> orders = buildOrders(orderBy);
        // 委托分页层内部执行入口完成数据库方言查询，深层不再声明 getPageList。
        return queryList(null, conditions, orders, pageNo, pageSize);
    }

    /**
     * 从公共参数中提取单主键或复合主键并查询一条记录。
     *
     * @param queryIn 主键参数，例如 {@code {"id":1}} 或 {@code {"tenantId":10,"orderId":20}}
     * @return 命中记录，例如 {@code {"id":1,"loginName":"admin"}}；参数为空或未命中时返回 {@code null}
     */
    @Override
    public Map<String, Object> getById(CommonParam queryIn) {
        // 通用参数为空或没有任何前端字段时按未命中返回，避免生成没有主键条件的查询。
        if (queryIn == null || queryIn.getParamMap() == null || queryIn.getParamMap().isEmpty()) {
            return null;
        }
        // 统一委托深层主键查询按元数据提取单主键或复合主键，门面层只公开稳定的 CommonParam 能力。
        return queryById(queryIn);
    }

    /**
     * 按每组最多一千项拆分主键，并批量查询全部匹配记录。
     *
     * @param queryIn 多组主键参数，例如 {@code {"items":[{"id":1},{"id":2}]}}
     * @return 数据库记录列表，例如 {@code [{"id":1},{"id":2}]}；空请求返回空列表
     */
    @Override
    public List<Map<String, Object>> getByIds(CommonBatchParam queryIn) {
        // 空批量请求直接返回空结果，确保不会生成没有主键条件的 SQL。
        if (queryIn == null || queryIn.getItems().isEmpty()) {
            return List.of();
        }
        // 使用可变列表按分组顺序汇总真实数据库返回记录。
        List<Map<String, Object>> records = new ArrayList<>();
        // 每次最多取一千项，避免单条批量查询包含过多数据库参数。
        for (int startIndex = 0; startIndex < queryIn.getItems().size(); startIndex += BATCH_OPERATION_SIZE) {
            // 当前分组结束位置不得超过请求总数。
            int endIndex = Math.min(startIndex + BATCH_OPERATION_SIZE, queryIn.getItems().size());
            // 深层批量查询一次读取当前分组，禁止循环执行单条 select 冒充批量能力。
            records.addAll(getByIdsBatchGroup(queryIn.getItems().subList(startIndex, endIndex)));
        }
        // 返回所有分组汇总后的数据库记录。
        return records;
    }

    /**
     * 按与真实数据库字段匹配的动态条件查询第一条记录。
     *
     * @param queryIn 动态条件，例如 {@code {"loginName":"admin","status":1}}
     * @return 第一条匹配记录，例如 {@code {"id":1,"loginName":"admin"}}；空条件或未命中时返回 {@code null}
     */
    @Override
    public Map<String, Object> getByQuery(CommonParam queryIn) {
        // 缺少通用查询对象或动态字段时直接返回空，防止空条件退化为全表首条查询。
        if (queryIn == null || queryIn.getParamMap() == null || queryIn.getParamMap().isEmpty()) {
            return null;
        }
        // 复制上游字段映射以隔离调用方对象，同时不注入 status、登录名或其他业务特定条件。
        Map<String, Object> queryColumnValueMap = copyColumnValueMap(queryIn.getParamMap());
        // 只通过公开分页能力读取第一条匹配记录，BaseDaoImpl 不直接触碰分页查询深层方法。
        CommonPageResult pageResult = getPageList(queryColumnValueMap, null, 1, 1);
        // 查询无结果时统一返回空，让调用方按未命中处理。
        if (pageResult == null || pageResult.getRecords() == null || pageResult.getRecords().isEmpty()) {
            return null;
        }
        // 返回第一条匹配记录，形成 BaseDao 对外稳定的动态单条查询能力。
        return pageResult.getRecords().get(0);
    }

    /**
     * 将公共参数中与真实数据库字段匹配的列新增到当前表。
     *
     * @param saveIn 新增字段，例如 {@code {"id":1,"loginName":"admin","status":1}}
     * @return 数据库影响行数，例如新增成功返回 {@code 1}
     * @throws IllegalArgumentException 没有可写数据库字段时抛出，例如 {@code "insert columns must not be empty"}
     */
    @Override
    public int insert(CommonParam saveIn) {
        // 把业务字段包装成模板新增入参，统一收口目标表和写入字段集合。
        CommonTemplateSave templateSave = new CommonTemplateSave();
        // 目标表继续使用公共元数据命名约定解析，业务层无需传递表名。
        templateSave.setTableName(getTableName());
        // 按数据库真实字段匹配上游参数，未知字段在 SQL 前阻断，未提供字段不写成 null。
        Map<String, Object> columnValueMap = buildDbColumnValueMap(saveIn);
        // 没有任何匹配字段时禁止生成空列 INSERT。
        if (columnValueMap.isEmpty()) {
            throw new IllegalArgumentException("insert columns must not be empty");
        }
        // 模板层只接收已经过数据库元数据匹配的受控字段和值。
        templateSave.setColumnValueMap(columnValueMap);
        // 通过模板 DAO 执行公共新增。
        return getBaseTemplateDao().insert(templateSave);
    }

    /**
     * 将新增项按每组最多一千条执行真实 JDBC 批处理。
     *
     * @param saveIn 批量新增字段，例如 {@code {"items":[{"id":1},{"id":2}]}}
     * @return 全部分组累计影响行数，例如两条成功返回 {@code 2}；空请求返回 {@code 0}
     */
    @Override
    public int insertBatch(CommonBatchParam saveIn) {
        // 空批量新增没有数据库动作，统一返回零影响行。
        if (saveIn == null || saveIn.getItems().isEmpty()) {
            return 0;
        }
        // affectedRows 累计每个真实批处理分组的数据库影响行数。
        int affectedRows = 0;
        // 目标表继续由当前 DAO 命名约定统一解析，所有分组复用同一张表。
        String tableName = getTableName();
        // 数据库真实字段映射只读取一次，供所有千条分组校验和生成 SQL 标识符。
        Map<String, ColumnMetadata> dbColumnsMap = getDbColumnsMap();
        // 固定按一千条步长遍历全部新增项。
        for (int startIndex = 0; startIndex < saveIn.getItems().size(); startIndex += BATCH_OPERATION_SIZE) {
            // 当前新增分组最多包含一千条。
            int endIndex = Math.min(startIndex + BATCH_OPERATION_SIZE, saveIn.getItems().size());
            // 每组统一交给模板 DAO 执行一次真实 JDBC batch，门面层不再拼接 INSERT SQL。
            affectedRows += getBaseTemplateDao().insertBatch(
                tableName,
                dbColumnsMap,
                saveIn.getItems().subList(startIndex, endIndex)
            );
        }
        // 返回所有分组累计影响行数，供 Service 形成批量结果。
        return affectedRows;
    }

    /**
     * 从公共参数自动分离完整主键和非主键字段后更新当前表。
     *
     * @param saveIn 主键和更新字段，例如 {@code {"id":1,"displayName":"管理员"}}
     * @return 数据库影响行数，例如更新成功返回 {@code 1}
     * @throws IllegalArgumentException 缺少主键或没有更新字段时抛出，例如
     *     {@code "primary key value must not be null: id"}
     */
    @Override
    public int update(CommonParam saveIn) {
        // 创建模板更新入参，集中承接目标表、主键和更新字段。
        CommonTemplateUpdate updateIn = new CommonTemplateUpdate();
        // 目标表继续使用公共元数据命名约定解析。
        updateIn.setTableName(getTableName());
        // 主键字段列表从当前表元数据读取，兼容单主键和复合主键。
        updateIn.setIdColumns(getPrimaryKeyColumnNameList());
        // 按数据库真实字段匹配前端参数，未知字段不会进入 SET 标识符。
        Map<String, Object> columnValueMap = buildDbColumnValueMap(saveIn);
        // 按 DAO 元数据顺序保存主键值，保证复合主键字段和值一一对应。
        List<Object> idValues = new ArrayList<>();
        // 每个主键字段从更新映射中取出后只用于 where，不会再次进入 set 子句。
        for (String idColumn : updateIn.getIdColumns()) {
            // 从已匹配字段中移除并保存当前主键值。
            Object idValue = columnValueMap.remove(idColumn);
            // 缺少任一单主键或复合主键值时禁止执行不完整 WHERE。
            if (idValue == null) {
                throw new IllegalArgumentException("primary key value must not be null: " + idColumn);
            }
            // 当前主键值按数据库元数据顺序进入 WHERE。
            idValues.add(idValue);
        }
        // 把自动提取的单主键或复合主键值写入模板更新条件。
        updateIn.setIdValues(idValues);
        // 没有任何非主键真实字段时禁止生成空 SET 更新。
        if (columnValueMap.isEmpty()) {
            throw new IllegalArgumentException("update columns must not be empty");
        }
        // 主键之外的已匹配字段作为待更新内容，不再由 Service 逐字段重新封装。
        updateIn.setColumnValueMap(columnValueMap);
        // 通过模板 DAO 执行公共主键更新。
        return getBaseTemplateDao().updateByIds(updateIn);
    }

    /**
     * 按每组最多一千条拆分更新项，并按相同字段结构执行真实 JDBC 批处理。
     *
     * @param saveIn 批量主键和更新字段，例如 {@code {"items":[{"id":1,"status":0},{"id":2,"status":0}]}}
     * @return 全部分组累计影响行数，例如两条成功返回 {@code 2}；空请求返回 {@code 0}
     */
    @Override
    public int updateBatch(CommonBatchParam saveIn) {
        // 空批量更新不进入数据库，统一返回零影响行。
        if (saveIn == null || saveIn.getItems().isEmpty()) {
            return 0;
        }
        // affectedRows 汇总全部字段结构分组的真实更新结果。
        int affectedRows = 0;
        // 目标表继续由当前 DAO 命名约定解析，避免模板层接收前端表名。
        String tableName = getTableName();
        // 主键字段一次性从真实表元数据读取，供所有千条分组复用同一更新条件结构。
        List<String> idColumns = getPrimaryKeyColumnNameList();
        // 数据库真实字段映射只读取一次，供模板层校验全部动态更新字段。
        Map<String, ColumnMetadata> dbColumnsMap = getDbColumnsMap();
        // 固定按一千条步长拆分外部批量请求。
        for (int startIndex = 0; startIndex < saveIn.getItems().size(); startIndex += BATCH_OPERATION_SIZE) {
            // 当前更新分组最多包含一千条。
            int endIndex = Math.min(startIndex + BATCH_OPERATION_SIZE, saveIn.getItems().size());
            // 模板 DAO 按更新字段结构归并并执行真实 JDBC batch，不循环调用公开单条 update。
            affectedRows += getBaseTemplateDao().updateBatchByIds(
                tableName,
                idColumns,
                dbColumnsMap,
                saveIn.getItems().subList(startIndex, endIndex)
            );
        }
        // 返回全部分组的累计更新行数。
        return affectedRows;
    }

    /**
     * 在原参数中补充公共删除状态和服务端时间，再按完整主键执行更新。
     *
     * @param deleteIn 主键和审计字段，例如 {@code {"id":1,"lastOperateUserId":9}}
     * @return 数据库影响行数，例如假删除成功返回 {@code 1}
     */
    @Override
    public int softDelete(CommonParam deleteIn) {
        // 状态字段写入平台统一的逻辑删除值，前端无需重复传递公共状态。
        deleteIn.putParam(SOFT_DELETE_STATUS_COLUMN, SOFT_DELETED_STATUS_VALUE);
        // 最后更新时间使用当前服务端时间，前端传入的 lastOperateUserId 等审计字段保持原样。
        deleteIn.putParam(SOFT_DELETE_UPDATED_AT_COLUMN, LocalDateTime.now());
        // 通过 BaseDao 公共更新入口自动提取主键并完成假删除。
        return update(deleteIn);
    }

    /**
     * 为全部删除项补充同一服务端时间和删除状态，再执行批量更新。
     *
     * @param deleteIn 多组主键和审计字段，例如 {@code {"items":[{"id":1},{"id":2}]}}
     * @return 全部分组累计影响行数，例如两条成功返回 {@code 2}；空请求返回 {@code 0}
     */
    @Override
    public int softDeleteBatch(CommonBatchParam deleteIn) {
        // 空批量删除没有目标记录，统一返回零影响行。
        if (deleteIn == null || deleteIn.getItems().isEmpty()) {
            return 0;
        }
        // 同一批请求共享删除时间，保证所有分组形成一致的业务时间点。
        LocalDateTime batchUpdatedAt = LocalDateTime.now();
        // 逐项补充公共逻辑删除字段，保留每条前端传入的主键和审计用户。
        for (CommonParam deleteItem : deleteIn.getItems()) {
            // 当前记录状态统一改为逻辑删除值。
            deleteItem.putParam(SOFT_DELETE_STATUS_COLUMN, SOFT_DELETED_STATUS_VALUE);
            // 当前记录更新时间统一使用本次批量请求时间。
            deleteItem.putParam(SOFT_DELETE_UPDATED_AT_COLUMN, batchUpdatedAt);
        }
        // 通过批量更新入口自动完成一千条分组和复合主键提取。
        return updateBatch(deleteIn);
    }

}
