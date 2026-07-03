package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.domain.CommonDynamicQuery;
import com.sp.selplat.common.db.domain.QueryCondition;
import com.sp.selplat.common.db.domain.QueryOperator;
import com.sp.selplat.common.db.domain.QueryOrder;
import com.sp.selplat.common.db.domain.QueryOrderDirection;
import com.sp.selplat.common.db.domain.query.CommonPageResult;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 通用分页查询 DAO 实现负责承接结构化动态查询和分页方言入口。
 *
 * <p>这里把分页查询从基础 CRUD 支撑层中抽离出来，
 * 是为了让 BaseDaoSupport 回到元数据和模板能力边界，
 * 同时让 BaseDaoImpl 只通过单一分页门面复用数据库差异查询能力。
 */
public abstract class BasePagingQueryDaoImpl extends BaseDaoSupportImpl {

    // 动态查询对象统一在分页查询基类中构建，避免分页字段、排序和页码逻辑再次散落回基础支撑层。
    protected CommonDynamicQuery buildDynamicQuery(List<String> selectFields,List<QueryCondition> conditions,List<QueryOrder> orders,Integer pageNo,Integer pageSize) {
        // 创建动态查询对象，把当前 DAO 的数据源、表和查询结构统一收口到同一个方言模型。
        CommonDynamicQuery query = new CommonDynamicQuery();
        // 当前动态查询固定命中当前 Spring 注入数据源，保证分页 SQL 使用正确数据库方言。
        query.setDataSource(resolveCurrentDbSource());
        // 当前动态查询固定命中当前 DAO 约定解析出的物理表，避免业务层重复传表名。
        query.setTableName(getTableName());
        // 当前动态查询若未显式传字段，则默认读取当前表全部字段，保持通用分页列表返回口径稳定。
        query.setSelectFields(resolveDynamicSelectFields(selectFields));
        // 当前动态查询直接承接结构化条件集合，让 where 条件继续走公共动态 SQL 校验链路。
        query.setConditions(conditions);
        // 当前动态查询直接承接结构化排序集合，让 order by 规则继续收口到统一查询 builder。
        query.setOrders(orders);
        // 当前动态查询记录页码，供方言分页 SQL 在不同数据库里统一计算偏移量。
        query.setPageNo(pageNo);
        // 当前动态查询记录每页条数，供方言分页 SQL 统一生成 limit 或 fetch 片段。
        query.setPageSize(pageSize);
        return query;
    }

    // 把简单列值映射转换成等值条件集合，让分页门面可以继续复用通用“按列等值匹配”的筛选语义。
    protected List<QueryCondition> buildEqualConditions(Map<String, Object> queryColumnValueMap) {
        // 调用方未传筛选条件时返回空集合，表示当前分页查询按全表条件继续执行。
        List<QueryCondition> conditions = new ArrayList<>();
        if (queryColumnValueMap == null || queryColumnValueMap.isEmpty()) {
            return conditions;
        }
        // 逐个字段生成 EQ 条件，保持和现有模板列表查询“按列等值匹配”的业务语义一致。
        for (Map.Entry<String, Object> entry : queryColumnValueMap.entrySet()) {
            QueryCondition condition = new QueryCondition();
            // 当前条件字段直接沿用调用方传入列名，后续由动态查询校验器检查是否合法。
            condition.setFieldName(entry.getKey());
            // 当前公共分页门面只承接等值匹配，和 BaseDaoImpl 现有列表筛选口径保持一致。
            condition.setOperator(QueryOperator.EQ);
            // 当前条件值直接承接调用方传入值，供底层 JDBC 按参数化方式绑定。
            condition.setValue(entry.getValue());
            conditions.add(condition);
        }
        return conditions;
    }

    // 把纯字段排序字符串转换成结构化排序集合，让分页门面的排序解析也收口到分页查询基类。
    protected List<QueryOrder> buildOrders(String orderBy) {
        // 未传排序时返回空集合，表示交给底层按无显式排序规则执行。
        List<QueryOrder> orders = new ArrayList<>();
        if (orderBy == null || orderBy.trim().isEmpty()) {
            return orders;
        }

        // 当前公共分页排序参数统一约定为“字段名 asc|desc 字段名 asc|desc ...”，例如 `sortnum desc id asc`，不再兼容 `order by` 前缀。
        String[] tokens = orderBy.trim().replace(",", " ").split("\\s+");
        for (int index = 0; index < tokens.length; index++) {
            String fieldName = tokens[index].trim();
            if (fieldName.isEmpty()) {
                continue;
            }
            // 排序表达式如果以 asc 或 desc 开头，说明调用方少传了字段名，直接抛错提醒修正入参。
            String normalizedFieldName = fieldName.toUpperCase(Locale.ROOT);
            if ("ASC".equals(normalizedFieldName) || "DESC".equals(normalizedFieldName)) {
                throw new IllegalArgumentException("missing order field before direction: " + fieldName);
            }
            QueryOrder order = new QueryOrder();
            // 当前 token 固定视为排序字段，供动态查询校验器后续校验字段是否真实存在。
            order.setFieldName(fieldName);
            // 未显式声明方向时默认按升序处理，避免单字段排序因为缺方向而直接失效。
            QueryOrderDirection direction = QueryOrderDirection.ASC;
            if (index + 1 < tokens.length) {
                String directionText = tokens[index + 1].trim().toUpperCase(Locale.ROOT);
                if ("DESC".equals(directionText)) {
                    direction = QueryOrderDirection.DESC;
                    // 当前字段已经消费掉后续 desc 方向 token，下轮循环从下一个字段继续解析。
                    index++;
                } else if ("ASC".equals(directionText)) {
                    // 当前字段已经消费掉后续 asc 方向 token，下轮循环从下一个字段继续解析。
                    index++;
                }
            }
            order.setDirection(direction);
            orders.add(order);
        }
        return orders;
    }

    // 分页列表查询统一走 dynamic query 链路，让不同数据库的分页语法都由方言层分发。
    protected CommonPageResult queryPage(List<String> selectFields,List<QueryCondition> conditions,List<QueryOrder> orders,Integer pageNo,Integer pageSize) {
        // 先构建启用分页的动态查询对象，让列表 SQL 和 count SQL 共用同一套筛选与排序语义。
        CommonDynamicQuery query = buildDynamicQuery(selectFields, conditions, orders, pageNo, pageSize);
        // 先查当前页记录，保证分页结果列表和总数字段使用同一动态查询上下文。
        List<Map<String, Object>> records = getCommonQueryExecutor().query(query);
        // 再查当前筛选条件下的总条数，供上层分页组件计算页数与展示总量。
        long totalCount = getCommonQueryExecutor().count(query);
        // 统一组装分页结果对象，避免业务 DAO 或 service 再手工拼 page/total 结构。
        CommonPageResult pageResult = new CommonPageResult();
        // 写入当前页结果列表，供调用方直接回显或继续映射成业务对象。
        pageResult.setRecords(records);
        // 写入当前筛选条件下的总记录数，供前端分页控件展示 total。
        pageResult.setTotalCount(totalCount);
        // 回填当前页码，保持返回结构和调用方分页入参语义一致。
        pageResult.setPageNo(pageNo);
        // 回填每页条数，保持返回结构和调用方分页入参语义一致。
        pageResult.setPageSize(pageSize);
        return pageResult;
    }

    // 非分页动态查询同样暴露统一入口，供数据库差异化排序或复杂筛选场景复用。
    protected List<Map<String, Object>> queryList(List<String> selectFields,List<QueryCondition> conditions,List<QueryOrder> orders) {
        // 构建非分页动态查询对象，让复杂列表查询和分页查询继续共用同一套条件与排序模型。
        CommonDynamicQuery query = buildDynamicQuery(selectFields, conditions, orders, null, null);
        // 当前查询入口直接复用统一查询执行器，让复杂列表查询仍由公共动态 SQL 链路承接。
        return getCommonQueryExecutor().query(query);
    }
}
