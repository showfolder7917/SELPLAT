package com.sp.selplat.common.db.query;

import com.sp.selplat.common.db.query.model.CommonDynamicQuery;
import com.sp.selplat.common.db.query.model.QueryCondition;
import com.sp.selplat.common.db.query.model.QueryOrder;
import java.util.List;

/**
 * 通用查询校验器接口统一抽象表、字段、条件和排序的合法性校验能力。
 * 这里先定义接口，是为了让后续实现可以按元数据、固定 JSON 定义或白名单规则分别落地。
 */
public interface CommonQueryValidator {

    /**
     * 校验完整查询对象。
     *
     * @param query 通用查询对象
     */
    void validate(CommonDynamicQuery query);

    /**
     * 校验表名。
     *
     * @param query 通用查询对象
     */
    void validateTable(CommonDynamicQuery query);

    /**
     * 校验查询字段集合。
     *
     * @param query 通用查询对象
     */
    void validateSelectFields(CommonDynamicQuery query);

    /**
     * 校验条件集合。
     *
     * @param query 通用查询对象
     * @param conditions 条件集合
     */
    void validateConditions(CommonDynamicQuery query, List<QueryCondition> conditions);

    /**
     * 校验排序集合。
     *
     * @param query 通用查询对象
     * @param orders 排序集合
     */
    void validateOrders(CommonDynamicQuery query, List<QueryOrder> orders);
}



