package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.query.model.CommonPageResult;
import com.sp.selplat.common.db.query.model.QueryCondition;
import com.sp.selplat.common.db.query.model.QueryOperator;
import com.sp.selplat.common.db.query.model.QueryOrder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * `BaseDaoImpl` 查询能力演示入口。
 *
 * <p>这个类只用于展示 `getPageList` 和结构化 `queryList` 的条件构造结果，
 * 不接真实数据库，也不依赖 Spring 容器，
 * 方便直接查看字段后缀和结构化条件最终会变成什么查询语义。
 */
public class BaseDaoQueryDemo {

    /**
     * 统一运行所有查询能力演示。
     *
     * @param args 命令行参数，当前演示不使用
     */
    public static void main(String[] args) {
        // 创建一个只打印查询结构的演示 DAO，避免示例运行时碰真实数据源。
        DemoBaseDaoImpl demoDao = new DemoBaseDaoImpl();
        // 依次执行各种查询能力演示，便于直接对照每种能力的入参与输出。
        demoEqual(demoDao);
        demoLike(demoDao);
        demoBeginEndAndView(demoDao);
        demoGreaterThanOrEqual(demoDao);
        demoLessThanOrEqual(demoDao);
        demoGreaterThan(demoDao);
        demoLessThan(demoDao);
        demoBetween(demoDao);
    }

    /**
     * 演示默认等于查询。
     *
     * @param demoDao 演示 DAO
     */
    private static void demoEqual(DemoBaseDaoImpl demoDao) {
        // 创建等于查询入参，未带后缀时会按默认 EQ 语义解析。
        Map<String, Object> queryMap = new LinkedHashMap<>();
        // status 没有操作符后缀，因此最终会走等值匹配。
        queryMap.put("status", "ENABLED");
        // 通过统一分页门面触发条件解析和排序解析。
        demoDao.getPageList(queryMap, "sortnum desc id asc", 1, 10);
    }

    /**
     * 演示模糊查询。
     *
     * @param demoDao 演示 DAO
     */
    private static void demoLike(DemoBaseDaoImpl demoDao) {
        // 创建模糊查询入参，字段后缀 Like 会被还原成真实字段名并转成 LIKE 操作符。
        Map<String, Object> queryMap = new LinkedHashMap<>();
        // nameLike 会被解析成字段 name 的模糊匹配条件，这里使用 ASCII 示例值避免控制台乱码干扰阅读。
        queryMap.put("nameLike", "platform");
        // 继续复用分页门面，直接观察字段后缀驱动的真实查询条件。
        demoDao.getPageList(queryMap, "name asc", 1, 10);
    }

    /**
     * 演示 Begin、End 和 View 后缀组合查询。
     *
     * @param demoDao 演示 DAO
     */
    private static void demoBeginEndAndView(DemoBaseDaoImpl demoDao) {
        // 创建区间和展示字段混合入参，验证 Begin/End 会参与查询而 View 会被跳过。
        Map<String, Object> queryMap = new LinkedHashMap<>();
        // createTimeBegin 会被解析成字段 createTime 的大于等于条件。
        queryMap.put("createTimeBegin", "2026-07-01 00:00:00");
        // createTimeEnd 会被解析成字段 createTime 的小于等于条件。
        queryMap.put("createTimeEnd", "2026-07-31 23:59:59");
        // deptNameView 仅用于展示，不应进入 where 条件。
        queryMap.put("deptNameView", "研发一部");
        // 触发统一分页门面，观察 Begin/End 的条件结果和 View 的跳过效果。
        demoDao.getPageList(queryMap, "createTime desc", 1, 10);
    }

    /**
     * 演示大于等于查询。
     *
     * @param demoDao 演示 DAO
     */
    private static void demoGreaterThanOrEqual(DemoBaseDaoImpl demoDao) {
        // 创建大于等于查询入参，常用于开始时间或最小值筛选。
        Map<String, Object> queryMap = new LinkedHashMap<>();
        // startDateGe 会被解析成字段 startDate 的 GTE 条件。
        queryMap.put("startDateGe", "2026-07-01");
        // 触发分页查询门面，查看 Ge 后缀是否正确转成大于等于条件。
        demoDao.getPageList(queryMap, "startDate desc", 1, 10);
    }

    /**
     * 演示小于等于查询。
     *
     * @param demoDao 演示 DAO
     */
    private static void demoLessThanOrEqual(DemoBaseDaoImpl demoDao) {
        // 创建小于等于查询入参，常用于结束时间或最大值筛选。
        Map<String, Object> queryMap = new LinkedHashMap<>();
        // endDateLe 会被解析成字段 endDate 的 LTE 条件。
        queryMap.put("endDateLe", "2026-07-31");
        // 继续通过分页门面打印结构化条件，确认 Le 后缀的解析结果。
        demoDao.getPageList(queryMap, "endDate asc", 1, 10);
    }

    /**
     * 演示大于查询。
     *
     * @param demoDao 演示 DAO
     */
    private static void demoGreaterThan(DemoBaseDaoImpl demoDao) {
        // 创建严格大于查询入参，常用于排他性的下限筛选。
        Map<String, Object> queryMap = new LinkedHashMap<>();
        // priceGt 会被解析成字段 price 的 GT 条件。
        queryMap.put("priceGt", 100);
        // 执行演示查询，直接观察 Gt 后缀是否正确映射成严格大于。
        demoDao.getPageList(queryMap, "price desc", 1, 10);
    }

    /**
     * 演示小于查询。
     *
     * @param demoDao 演示 DAO
     */
    private static void demoLessThan(DemoBaseDaoImpl demoDao) {
        // 创建严格小于查询入参，常用于排他性的上限筛选。
        Map<String, Object> queryMap = new LinkedHashMap<>();
        // discountLt 会被解析成字段 discount 的 LT 条件。
        queryMap.put("discountLt", 50);
        // 执行演示查询，直接观察 Lt 后缀是否正确映射成严格小于。
        demoDao.getPageList(queryMap, "discount asc", 1, 10);
    }

    /**
     * 演示 between 查询。
     *
     * @param demoDao 演示 DAO
     */
    private static void demoBetween(DemoBaseDaoImpl demoDao) {
        // 当前 `Map + 字段后缀` 入口还没有 between 后缀语义，因此这里单独演示结构化条件写法。
        QueryCondition betweenCondition = new QueryCondition();
        // createTime 作为区间查询字段，直接写入真实业务字段名。
        betweenCondition.setFieldName("createTime");
        // BETWEEN 操作符表示当前条件需要同时携带起始值和结束值。
        betweenCondition.setOperator(QueryOperator.BETWEEN);
        // 首值作为区间开始边界。
        betweenCondition.setValue("2026-07-01 00:00:00");
        // 次值作为区间结束边界。
        betweenCondition.setSecondValue("2026-07-31 23:59:59");
        // 把 between 条件放入结构化条件集合，供底层统一打印。
        List<QueryCondition> conditions = new ArrayList<>();
        conditions.add(betweenCondition);
        // 直接通过结构化排序构建器生成排序结果，保持和正式查询链路一致。
        List<QueryOrder> orders = demoDao.buildOrders("createTime desc");
        // 调用演示 DAO 的结构化查询入口，展示 between 条件的最终结构。
        demoDao.queryList(null, conditions, orders, 1, 10);
    }

    /**
     * 只负责打印查询结构的演示 DAO。
     *
     * <p>这个内部类覆写了真正执行查询的方法，
     * 让 `getPageList` 仍然走原始条件解析逻辑，
     * 但最终只输出结构化结果，不连接数据库。
     */
    private static class DemoBaseDaoImpl extends BaseDaoImpl {

        /**
         * 覆写表名解析，避免按当前 demo 类名推导出不存在的物理表名。
         *
         * @return 演示表名
         */
        @Override
        protected String getTableName() {
            // 演示固定返回 sample_table，便于输出时明确当前查询目标。
            return "sample_table";
        }

        /**
         * 覆写字段清单解析，避免运行演示时触发真实元数据读取。
         *
         * @return 演示字段列表
         */
        @Override
        protected String getselectColumns() {
            // 演示固定返回一组常见列表字段，保证 queryList 的默认字段解析可继续运行。
            return "id, name, status, startDate, endDate, price, discount, createTime, sortnum";
        }

        /**
         * 覆写真实分页查询执行，只打印解析后的结构化条件和排序。
         *
         * @param selectFields 返回字段集合
         * @param conditions 条件集合
         * @param orders 排序集合
         * @param pageNo 页码
         * @param pageSize 每页条数
         * @return 空分页结果，仅用于保持方法签名一致
         */
        @Override
        protected CommonPageResult queryList(List<String> selectFields, List<QueryCondition> conditions, List<QueryOrder> orders, Integer pageNo, Integer pageSize) {
            // 先输出分隔线，便于区分每次演示的打印块。
            System.out.println("==================================================");
            // 输出演示命中的目标表，方便确认当前门面最终会查哪张表。
            System.out.println("tableName = " + getTableName());
            // 输出最终返回字段，方便确认默认字段解析是否按预期工作。
            System.out.println("selectFields = " + resolveDynamicSelectFields(selectFields));
            // 输出分页参数，方便确认分页门面是否透传页码和页大小。
            System.out.println("pageNo = " + pageNo + ", pageSize = " + pageSize);
            // 输出结构化条件标题，便于阅读后续每个条件的解析结果。
            System.out.println("conditions:");
            // 当前没有条件时明确打印空条件，避免误判为打印缺失。
            if (conditions == null || conditions.isEmpty()) {
                System.out.println("  (empty)");
            } else {
                // 逐个输出条件的字段、操作符和值，直接展示 BaseDaoImpl 的解析结果。
                for (QueryCondition condition : conditions) {
                    // BETWEEN 需要额外输出 secondValue，其他操作符只输出单值即可。
                    if (QueryOperator.BETWEEN == condition.getOperator()) {
                        System.out.println(
                            "  field=" + condition.getFieldName()
                                + ", operator=" + condition.getOperator()
                                + ", value=" + condition.getValue()
                                + ", secondValue=" + condition.getSecondValue()
                        );
                    } else {
                        System.out.println(
                            "  field=" + condition.getFieldName()
                                + ", operator=" + condition.getOperator()
                                + ", value=" + condition.getValue()
                        );
                    }
                }
            }
            // 输出结构化排序标题，便于确认排序字符串的拆分结果。
            System.out.println("orders:");
            // 当前没有排序时明确打印空排序，避免误判为解析失败。
            if (orders == null || orders.isEmpty()) {
                System.out.println("  (empty)");
            } else {
                // 逐个输出排序字段和方向，直接展示排序字符串的解析结果。
                for (QueryOrder order : orders) {
                    System.out.println("  field=" + order.getFieldName() + ", direction=" + order.getDirection());
                }
            }
            // 构造一个空分页结果返回给调用方，保持演示 DAO 的方法契约完整。
            CommonPageResult pageResult = new CommonPageResult();
            // 演示模式下不查真实数据，因此结果记录列表固定为空。
            pageResult.setRecords(new ArrayList<>());
            // 演示模式下不查真实数据，因此总数固定回填为零。
            pageResult.setTotalCount(0L);
            // 回填页码，保证返回结构和正式查询保持同样的分页口径。
            pageResult.setPageNo(pageNo);
            // 回填每页条数，保证返回结构和正式查询保持同样的分页口径。
            pageResult.setPageSize(pageSize);
            return pageResult;
        }
    }
}
