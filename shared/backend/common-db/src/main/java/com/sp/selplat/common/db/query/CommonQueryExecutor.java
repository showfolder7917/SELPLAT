package com.sp.selplat.common.db.query;

import com.sp.selplat.common.db.query.model.CommonDynamicQuery;
import java.util.List;
import java.util.Map;

/**
 * 通用查询执行器接口统一抽象结构化查询对象的执行入口。
 * 这里先约定列表、一行和总数三类基础执行能力，
 * 便于后续上层 DAO 直接复用同一条通用查询链路。
 */
public interface CommonQueryExecutor {

    /**
     * 执行列表查询。
     *
     * @param query 通用查询对象
     * @return 数据库列值列表，例如 {@code [{"id":10001,"login_name":"admin","status":1}]}
     */
    List<Map<String, Object>> query(CommonDynamicQuery query);

    /**
     * 执行单行查询。
     *
     * @param query 通用查询对象
     * @return 单行数据库列值，例如 {@code {"id":10001,"login_name":"admin","status":1}}；
     *     无匹配记录时返回空 Map
     */
    Map<String, Object> queryOne(CommonDynamicQuery query);

    /**
     * 执行总数查询。
     *
     * @param query 通用查询对象
     * @return 满足条件的记录数，例如 {@code 12L}
     */
    long count(CommonDynamicQuery query);
}
