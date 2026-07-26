package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageResult;
import java.util.List;
import java.util.Map;

// 公共 DAO 接口统一声明简单单表模块允许调用的分页、查询、新增、更新和假删除能力。
public interface BaseDao {

    // 主键号段定义由 DAO 的表名和有序主键元数据生成每个字段的独立号段编码，业务服务无需硬编码对应关系。
    IdSequenceDefinition getIdSequenceDefinition();

    // 默认分页查询按公共排序口径返回当前页结果，供后台列表快速复用统一分页链路。
    CommonPageResult getPageList(Map<String, Object> queryColumnValueMap, Integer pageNo, Integer pageSize);

    // 自定义排序分页查询允许业务模块补充排序表达式，同时继续复用公共动态查询能力。
    CommonPageResult getPageList(Map<String, Object> queryColumnValueMap, String orderBy, Integer pageNo, Integer pageSize);

    // 通用主键查询从前端 CommonParam 按 DAO 主键元数据提取字段值，兼容单主键和复合主键。
    Map<String, Object> getById(CommonParam queryIn);

    // 通用批量主键查询从每个 CommonParam 提取完整主键，并按固定批次读取当前表记录。
    List<Map<String, Object>> getByIds(CommonBatchParam queryIn);

    // 通用动态单条查询只消费上游 CommonParam 中的字段，禁止业务 DAO 再调用深层条件构建方法。
    Map<String, Object> getByQuery(CommonParam queryIn);

    // 通用新增接口直接读取上游 CommonParam 动态字段并写入当前 DAO 对应表。
    int insert(CommonParam saveIn);

    // 通用批量新增按每组最多一千条执行真实 JDBC 批处理，并汇总全部影响行数。
    int insertBatch(CommonBatchParam saveIn);

    // 通用更新接口从 CommonParam 自动提取单主键或复合主键，其余前端字段直接作为更新内容。
    int update(CommonParam saveIn);

    // 通用批量更新允许每条记录使用不同更新字段，并按 SQL 字段结构分组执行真实 JDBC 批处理。
    int updateBatch(CommonBatchParam saveIn);

    // 通用假删除接口从 CommonParam 自动提取主键，并统一补充逻辑删除状态和更新时间。
    int softDelete(CommonParam deleteIn);

    // 通用批量假删除统一补逻辑删除字段后按每组最多一千条调用批量更新。
    int softDeleteBatch(CommonBatchParam deleteIn);
}
