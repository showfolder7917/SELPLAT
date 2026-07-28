package com.sp.selplat.common.util;

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
     * @return 当前页结果列表，例如 {@code [{"id":2,"loginName":"user-b"},{"id":1,"loginName":"user-a"}]}
     */
    public List<Map<String, Object>> getRecords() {
        return records;
    }

    /**
     * 设置当前页结果列表。
     *
     * @param records 来自 DAO 分页查询的当前页记录，例如
     *     {@code [{"id":2,"loginName":"user-b"},{"id":1,"loginName":"user-a"}]}
     * 执行结果示例：分页结果的 records 字段保持同样的数据库返回顺序。
     */
    public void setRecords(List<Map<String, Object>> records) {
        this.records = records;
    }

    /**
     * 获取总记录数。
     *
     * @return 当前筛选条件下的总记录数，例如 {@code 2}
     */
    public long getTotalCount() {
        return totalCount;
    }

    /**
     * 设置总记录数。
     *
     * @param totalCount 来自分页 COUNT 查询的总记录数，例如 {@code 2}
     * 执行结果示例：分页结果顶层包含 {@code "totalCount":2}。
     */
    public void setTotalCount(long totalCount) {
        this.totalCount = totalCount;
    }

    /**
     * 获取页码。
     *
     * @return 当前页码，例如 {@code 1}
     */
    public Integer getPageNo() {
        return pageNo;
    }

    /**
     * 设置页码。
     *
     * @param pageNo 来自分页请求的页码，例如 {@code 1}
     * 执行结果示例：分页结果顶层包含 {@code "pageNo":1}。
     */
    public void setPageNo(Integer pageNo) {
        this.pageNo = pageNo;
    }

    /**
     * 获取每页条数。
     *
     * @return 每页条数，例如 {@code 10}
     */
    public Integer getPageSize() {
        return pageSize;
    }

    /**
     * 设置每页条数。
     *
     * @param pageSize 来自分页请求的每页条数，例如 {@code 10}
     * 执行结果示例：完整结构为
     *     {@code {"records":[{"id":2,"loginName":"user-b"},{"id":1,"loginName":"user-a"}],}
     *     {@code "totalCount":2,"pageNo":1,"pageSize":10}}。
     */
    public void setPageSize(Integer pageSize) {
        this.pageSize = pageSize;
    }
}
