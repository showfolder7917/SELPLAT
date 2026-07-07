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
     * @return 列表结果
     */
    List<Map<String, Object>> query(CommonDynamicQuery query);

    /**
     * 执行单行查询。
     *
     * @param query 通用查询对象
     * @return 单行结果
     */
    Map<String, Object> queryOne(CommonDynamicQuery query);

    /**
     * 执行总数查询。
     *
     * @param query 通用查询对象
     * @return 总数结果
     */
    long count(CommonDynamicQuery query);
}

