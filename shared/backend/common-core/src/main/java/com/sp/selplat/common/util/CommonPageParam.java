package com.sp.selplat.common.util;

/**
 * 通用分页参数对象统一承接动态查询字段和分页入参。
 * 这里把原先散落在各模块专用 In/Out 实体里的分页查询通用能力收口成一个对象，
 * 让控制层、服务层和 DAO 层都可以直接围绕同一套分页入参与动态条件传递查询语义。
 */
public class CommonPageParam extends CommonParam {

    // pageNo 表示当前请求页码，默认第一页，便于非显式传值时仍能落到稳定分页语义。
    private Integer pageNo = 1;
    // pageSize 表示每页条数，默认二十条，便于列表接口在未传值时仍有稳定分页大小。
    private Integer pageSize = 20;

    /**
     * 获取当前页码。
     *
     * @return 当前页码
     */
    public Integer getPageNo() {
        // 返回当前页码，供列表控制层、服务层和 DAO 统一沿用同一分页语义。
        return pageNo;
    }

    /**
     * 设置当前页码。
     *
     * @param pageNo 当前页码
     */
    public void setPageNo(Integer pageNo) {
        // 调用方未传或传入非法页码时，统一兜底回第一页，避免出现零页或负页。
        this.pageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
    }

    /**
     * 获取每页条数。
     *
     * @return 每页条数
     */
    public Integer getPageSize() {
        // 返回当前每页条数，供分页查询链路和响应对象统一回填同一值。
        return pageSize;
    }

    /**
     * 设置每页条数。
     *
     * @param pageSize 每页条数
     */
    public void setPageSize(Integer pageSize) {
        // 调用方未传或传入非法条数时，统一回退到默认大小，避免列表接口一次取全表。
        this.pageSize = pageSize == null || pageSize < 1 ? 20 : pageSize;
    }
}
