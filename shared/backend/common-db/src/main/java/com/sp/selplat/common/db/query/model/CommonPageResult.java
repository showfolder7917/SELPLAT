package com.sp.selplat.common.db.query.model;

import java.util.List;
import java.util.Map;

/**
 * 通用分页结果对象统一承接列表数据、总数和页码信息。
 * 这里把分页查询的返回结构收口成稳定对象，
 * 是为了让调用方不再自己到处拼 total、pageNo、pageSize 和列表数据。
 */
public class CommonPageResult {

    // records 承接当前页的结果列表，供调用方直接渲染表格或继续映射业务对象。
    private List<Map<String, Object>> records;
    // totalCount 承接当前筛选条件下的总记录数，供分页组件展示总条数和总页数。
    private long totalCount;
    // pageNo 承接本次返回对应的页码，供调用方回显当前页状态。
    private Integer pageNo;
    // pageSize 承接本次返回对应的每页条数，供调用方保持分页参数一致。
    private Integer pageSize;

    /**
     * 获取当前页结果列表。
     *
     * @return 当前页结果列表
     */
    public List<Map<String, Object>> getRecords() {
        return records;
    }

    /**
     * 设置当前页结果列表。
     *
     * @param records 当前页结果列表
     */
    public void setRecords(List<Map<String, Object>> records) {
        this.records = records;
    }

    /**
     * 获取总记录数。
     *
     * @return 总记录数
     */
    public long getTotalCount() {
        return totalCount;
    }

    /**
     * 设置总记录数。
     *
     * @param totalCount 总记录数
     */
    public void setTotalCount(long totalCount) {
        this.totalCount = totalCount;
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

