package com.sp.selplat.common.db.domain;

import com.sp.selplat.common.db.config.CommonDbSource;
import java.util.List;

/**
 * 通用动态查询对象统一承接上层 DAO 传入的完整查询描述。
 * 这里把数据源、表名、字段、条件、排序和分页统一收口，
 * 是为了让 common-db 在不感知具体业务的前提下执行通用查询。
 */
public class CommonDynamicQuery {

    // dataSource 承接上层 DAO 选定的数据源实体，供底层直接获知连接、数据库类型和目标库信息。
    private CommonDbSource dataSource;
    // tableName 指定当前查询要命中的物理表，供底层生成 from 子句并做表合法性校验。
    private String tableName;
    // selectFields 承接本次查询实际要返回的字段清单，供底层生成 select 子句。
    private List<String> selectFields;
    // conditions 承接本次查询的结构化条件集合，供底层统一翻译 where 子句。
    private List<QueryCondition> conditions;
    // orders 承接本次查询的结构化排序集合，供底层统一翻译 order by 子句。
    private List<QueryOrder> orders;
    // pageNo 承接当前页码，供底层在启用分页时计算偏移量。
    private Integer pageNo;
    // pageSize 承接每页条数，供底层在启用分页时生成 limit/offset 或同类方言语句。
    private Integer pageSize;

    /**
     * 获取数据源实体。
     *
     * @return 数据源实体
     */
    public CommonDbSource getDataSource() {
        return dataSource;
    }

    /**
     * 设置数据源实体。
     *
     * @param dataSource 数据源实体
     */
    public void setDataSource(CommonDbSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * 获取目标表名。
     *
     * @return 目标表名
     */
    public String getTableName() {
        return tableName;
    }

    /**
     * 设置目标表名。
     *
     * @param tableName 目标表名
     */
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    /**
     * 获取查询字段清单。
     *
     * @return 查询字段清单
     */
    public List<String> getSelectFields() {
        return selectFields;
    }

    /**
     * 设置查询字段清单。
     *
     * @param selectFields 查询字段清单
     */
    public void setSelectFields(List<String> selectFields) {
        this.selectFields = selectFields;
    }

    /**
     * 获取结构化条件集合。
     *
     * @return 结构化条件集合
     */
    public List<QueryCondition> getConditions() {
        return conditions;
    }

    /**
     * 设置结构化条件集合。
     *
     * @param conditions 结构化条件集合
     */
    public void setConditions(List<QueryCondition> conditions) {
        this.conditions = conditions;
    }

    /**
     * 获取结构化排序集合。
     *
     * @return 结构化排序集合
     */
    public List<QueryOrder> getOrders() {
        return orders;
    }

    /**
     * 设置结构化排序集合。
     *
     * @param orders 结构化排序集合
     */
    public void setOrders(List<QueryOrder> orders) {
        this.orders = orders;
    }

    /**
     * 获取页码。
     *
     * @return 页码
     */
    public Integer getPageNo() {
        return pageNo;
    }

    /**
     * 设置页码。
     *
     * @param pageNo 页码
     */
    public void setPageNo(Integer pageNo) {
        this.pageNo = pageNo;
    }

    /**
     * 获取每页条数。
     *
     * @return 每页条数
     */
    public Integer getPageSize() {
        return pageSize;
    }

    /**
     * 设置每页条数。
     *
     * @param pageSize 每页条数
     */
    public void setPageSize(Integer pageSize) {
        this.pageSize = pageSize;
    }
}
