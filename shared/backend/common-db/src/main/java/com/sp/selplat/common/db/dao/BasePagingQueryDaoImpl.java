package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.query.model.CommonDynamicQuery;
import com.sp.selplat.common.db.query.model.CommonPageResult;
import com.sp.selplat.common.db.query.model.QueryCondition;
import com.sp.selplat.common.db.query.model.QueryOperator;
import com.sp.selplat.common.db.query.model.QueryOrder;
import com.sp.selplat.common.db.query.model.QueryOrderDirection;

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

    // 分页列表查询统一走 dynamic query 链路，让不同数据库的分页语法都由方言层分发。
    protected CommonPageResult queryList(List<String> selectFields,List<QueryCondition> conditions,List<QueryOrder> orders,Integer pageNo,Integer pageSize) {
        // 直接创建启用分页的动态查询对象，避免单次调用的中间方法继续增加阅读跳转。
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
    
    // 分页查询基类需要复用当前表的默认字段清单，避免分页链路再次复制字段元数据解析逻辑。
    protected List<String> resolveDynamicSelectFields(List<String> selectFields) {
        // 调用方显式声明字段时直接沿用，保证复杂查询场景可以精确控制返回列。
        if (selectFields != null && !selectFields.isEmpty()) {
            return selectFields;
        }
        // 调用方未传字段时退回当前表完整字段列表，保持通用列表和分页列表的返回口径一致。
        return List.of(getselectColumns().split(",\\s*"));
    }

    // 把简单列值映射转换成结构化条件集合，让分页门面可以通过字段后缀表达常见筛选语义。
    protected List<QueryCondition> buildQueryConditions(Map<String, Object> queryColumnValueMap) {
        // 调用方未传筛选条件时返回空集合，表示当前分页查询按全表条件继续执行。
        List<QueryCondition> conditions = new ArrayList<>();
        if (queryColumnValueMap == null || queryColumnValueMap.isEmpty()) {
            return conditions;
        }
        // 逐个字段解析后缀并生成对应条件，让简单分页门面也能承接模糊、上下界等常见列表筛选。
        for (Map.Entry<String, Object> entry : queryColumnValueMap.entrySet()) {
            // 展示型字段只用于页面回显，不应进入 where 条件，因此这里直接跳过。
            if (shouldIgnoreConditionField(entry.getKey())) {
                continue;
            }
            QueryCondition condition = new QueryCondition();
            // 当前条件字段按统一后缀规则还原成真实业务字段名，供动态查询校验器继续做字段合法性校验。
            condition.setFieldName(resolveConditionFieldName(entry.getKey()));
            // 当前条件操作符按字段后缀决定，未声明后缀时继续沿用等值匹配语义。
            condition.setOperator(resolveConditionOperator(entry.getKey()));
            // 当前条件值直接承接调用方传入值，供底层 JDBC 按参数化方式绑定。
            condition.setValue(entry.getValue());
            conditions.add(condition);
        }
        return conditions;
    }

    // 识别只用于展示的字段后缀，让页面回显辅助字段不会误入数据库筛选条件。
    private boolean shouldIgnoreConditionField(String rawFieldName) {
        // View 后缀统一表示仅展示字段，供分页门面在条件构建前直接忽略。
        return rawFieldName != null && rawFieldName.endsWith("View");
    }

    // 通过字段后缀解析真实字段名，让简单分页入参不用额外定义复杂条件对象也能表达常见筛选语义。
    private String resolveConditionFieldName(String rawFieldName) {
        // 字段名为空时直接原样返回，后续仍交给统一校验器按非法字段收口。
        if (rawFieldName == null || rawFieldName.trim().isEmpty()) {
            return rawFieldName;
        }
        // View 后缀字段只用于展示，这里仍去掉后缀，保证调试输出或后续扩展时语义稳定。
        if (rawFieldName.endsWith("View")) {
            return rawFieldName.substring(0, rawFieldName.length() - "View".length());
        }
        // 先按最长后缀匹配，避免 like、gte 等后缀之间出现截断歧义。
        if (rawFieldName.endsWith("Like")) {
            return rawFieldName.substring(0, rawFieldName.length() - "Like".length());
        }
        // Begin 后缀统一表示区间开始边界，字段名还原后继续走受控字段校验。
        if (rawFieldName.endsWith("Begin")) {
            return rawFieldName.substring(0, rawFieldName.length() - "Begin".length());
        }
        // End 后缀统一表示区间结束边界，字段名还原后继续走受控字段校验。
        if (rawFieldName.endsWith("End")) {
            return rawFieldName.substring(0, rawFieldName.length() - "End".length());
        }
        // Ge 后缀统一表示大于等于筛选，字段名还原后继续走受控字段校验。
        if (rawFieldName.endsWith("Ge")) {
            return rawFieldName.substring(0, rawFieldName.length() - "Ge".length());
        }
        // Gt 后缀统一表示严格大于筛选，字段名还原后继续走受控字段校验。
        if (rawFieldName.endsWith("Gt")) {
            return rawFieldName.substring(0, rawFieldName.length() - "Gt".length());
        }
        // Le 后缀统一表示小于等于筛选，字段名还原后继续走受控字段校验。
        if (rawFieldName.endsWith("Le")) {
            return rawFieldName.substring(0, rawFieldName.length() - "Le".length());
        }
        // Lt 后缀统一表示严格小于筛选，字段名还原后继续走受控字段校验。
        if (rawFieldName.endsWith("Lt")) {
            return rawFieldName.substring(0, rawFieldName.length() - "Lt".length());
        }
        // 未声明操作后缀时直接沿用原字段名，保持默认等值查询口径不变。
        return rawFieldName;
    }

    // 通过字段后缀解析比较操作符，让分页门面在保持 Map 入参的前提下支持更多查询语义。
    private QueryOperator resolveConditionOperator(String rawFieldName) {
        // 字段后缀为 Like 时按模糊查询处理，适合名称、编码等关键字检索。
        if (rawFieldName != null && rawFieldName.endsWith("Like")) {
            return QueryOperator.LIKE;
        }
        // 字段后缀为 Begin 时按大于等于处理，适合时间区间和数值区间的开始边界。
        if (rawFieldName != null && rawFieldName.endsWith("Begin")) {
            return QueryOperator.GTE;
        }
        // 字段后缀为 End 时按小于等于处理，适合时间区间和数值区间的结束边界。
        if (rawFieldName != null && rawFieldName.endsWith("End")) {
            return QueryOperator.LTE;
        }
        // 字段后缀为 Ge 时按大于等于处理，适合起始时间和最小值筛选。
        if (rawFieldName != null && rawFieldName.endsWith("Ge")) {
            return QueryOperator.GTE;
        }
        // 字段后缀为 Gt 时按严格大于处理，适合排他性的下限筛选。
        if (rawFieldName != null && rawFieldName.endsWith("Gt")) {
            return QueryOperator.GT;
        }
        // 字段后缀为 Le 时按小于等于处理，适合结束时间和最大值筛选。
        if (rawFieldName != null && rawFieldName.endsWith("Le")) {
            return QueryOperator.LTE;
        }
        // 字段后缀为 Lt 时按严格小于处理，适合排他性的上限筛选。
        if (rawFieldName != null && rawFieldName.endsWith("Lt")) {
            return QueryOperator.LT;
        }
        // 未声明后缀时继续沿用默认等值匹配，保持现有简单列表调用不受影响。
        return QueryOperator.EQ;
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
}




