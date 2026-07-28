package com.sp.selplat.common.util;

/**
 * 通用分页入参对象，用于承接控制层从查询字符串绑定过来的页码和每页条数。
 */
public class Page {

    // pageNo 表示当前请求页码，默认第一页，便于老接口未传值时仍能落到稳定分页语义。
    private Integer pageNo = 1;
    // pageSize 表示每页条数，默认二十条，便于列表页在未传值时有最小可用分页大小。
    private Integer pageSize = 20;

    /**
     * 获取当前页码。
     *
     * @return 当前页码，例如 {@code 1}
     */
    public Integer getPageNo() {
        return pageNo;
    }

    /**
     * 设置当前页码。
     *
     * @param pageNo 来自旧式分页请求的页码，例如 {@code 2}
     * 执行结果示例：输入 {@code null}、{@code 0} 或负数时保存为 {@code 1}。
     */
    public void setPageNo(Integer pageNo) {
        // 调用方未传或传入非法页码时，统一兜底回第一页，避免出现零页或负页。
        this.pageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
    }

    /**
     * 获取每页条数。
     *
     * @return 每页条数，例如 {@code 20}
     */
    public Integer getPageSize() {
        return pageSize;
    }

    /**
     * 设置每页条数。
     *
     * @param pageSize 来自旧式分页请求的每页条数，例如 {@code 50}
     * 执行结果示例：输入 {@code null}、{@code 0} 或负数时保存为 {@code 20}。
     */
    public void setPageSize(Integer pageSize) {
        // 调用方未传或传入非法条数时，统一兜底回默认分页大小，避免列表接口一次取全表。
        this.pageSize = pageSize == null || pageSize < 1 ? 20 : pageSize;
    }
}
