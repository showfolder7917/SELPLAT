package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.domain.CommonPageResult;
import com.sp.selplat.common.db.domain.QueryCondition;
import com.sp.selplat.common.db.domain.QueryOrder;
import java.util.List;
import java.util.Map;

/**
 * 通用分页查询 DAO 负责对外暴露数据库方言差异查询入口。
 * 这里把分页和结构化动态查询从基础 CRUD 门面中拆开，
 * 是为了避免 BaseDaoImpl 继续膨胀成既管增删改查又管数据库特定查询的混合层。
 */
public abstract class BasePagingQueryDao extends BaseDaoSupport {

    // 分页列表查询统一走 dynamic query 链路，让不同数据库的分页语法都由方言层分发。
    protected CommonPageResult queryPage(
        List<String> selectFields,
        List<QueryCondition> conditions,
        List<QueryOrder> orders,
        Integer pageNo,
        Integer pageSize
    ) {
        // 当前分页入口只负责把分页参数交给公共查询链路，不在 DAO 层自己判断数据库方言。
        return queryDynamicPage(selectFields, conditions, orders, pageNo, pageSize);
    }

    // 非分页动态查询同样暴露统一入口，供数据库差异化排序或复杂筛选场景复用。
    protected List<Map<String, Object>> queryList(
        List<String> selectFields,
        List<QueryCondition> conditions,
        List<QueryOrder> orders
    ) {
        // 当前查询入口直接复用公共动态查询执行器，让复杂列表查询和分页查询共用同一套规则。
        return queryDynamicList(selectFields, conditions, orders);
    }
}
