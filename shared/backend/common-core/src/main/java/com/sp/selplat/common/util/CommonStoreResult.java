package com.sp.selplat.common.util;

import java.util.List;
import java.util.Map;

/**
 * store 接口统一返回对象，专门承接旧式页面联调依赖的顶层分页结果结构。
 * 这里显式收口 success、rows、total 和分页信息，
 * 避免各业务服务继续直接手拼 Map 导致返回字段口径分裂。
 */
public class CommonStoreResult {

    // success 表示当前 store 查询链路是否执行成功，供旧式页面先判断接口状态。
    private boolean success;
    // moduleCode 标记当前返回属于哪个业务模块的 store 查询，便于联调时区分接口来源。
    private String moduleCode;
    // requestPath 回传命中的接口路径，便于前端或联调人员核对实际访问路由。
    private String requestPath;
    // query 回传当前生效的共通分页参数对象，便于确认筛选条件和分页参数已正确绑定。
    private CommonPageParam query;
    // rows 承接当前页记录列表，保持旧式 store 页面可直接读取表格数据。
    private List<Map<String, Object>> rows;
    // total 承接当前筛选条件下的总记录数，供旧式分页控件计算总页数。
    private long total;
    // pageNo 回传当前页码，便于前端和联调人员确认翻页参数已生效。
    private Integer pageNo;
    // pageSize 回传每页条数，便于保持前后端分页口径一致。
    private Integer pageSize;
    // msg 回传当前 store 接口的说明文案，便于联调阶段直接看到接口状态提示。
    private String msg;

    /**
     * 返回当前 store 查询是否成功。
     *
     * @return 是否成功
     */
    public boolean isSuccess() {
        // 直接返回当前结果对象的成功标记，供 JSON 序列化后保持统一 success 字段。
        return success;
    }

    /**
     * 设置当前 store 查询是否成功。
     *
     * @param success 是否成功
     */
    public void setSuccess(boolean success) {
        // 把调用方传入的成功标记写入统一结果对象，避免业务服务再各自命名状态字段。
        this.success = success;
    }

    /**
     * 返回模块编码。
     *
     * @return 模块编码
     */
    public String getModuleCode() {
        // 返回当前 store 返回绑定的模块编码，供调用方区分具体业务来源。
        return moduleCode;
    }

    /**
     * 设置模块编码。
     *
     * @param moduleCode 模块编码
     */
    public void setModuleCode(String moduleCode) {
        // 写入当前业务模块编码，统一沉淀到公共结果对象而不是分散在 Map 常量里。
        this.moduleCode = moduleCode;
    }

    /**
     * 返回请求路径。
     *
     * @return 请求路径
     */
    public String getRequestPath() {
        // 返回当前 store 查询命中的请求路径，便于联调阶段直接核对访问入口。
        return requestPath;
    }

    /**
     * 设置请求路径。
     *
     * @param requestPath 请求路径
     */
    public void setRequestPath(String requestPath) {
        // 写入当前 store 接口路径，统一保证所有 store 返回结构都带路由信息。
        this.requestPath = requestPath;
    }

    /**
     * 返回当前查询参数对象。
     *
     * @return 查询参数对象
     */
    public CommonPageParam getQuery() {
        // 返回已补齐记录数和筛选条件的共通参数对象，便于前端或联调人员查看请求上下文。
        return query;
    }

    /**
     * 设置当前查询参数对象。
     *
     * @param query 查询参数对象
     */
    public void setQuery(CommonPageParam query) {
        // 把实际参与查询的共通参数对象回填到统一结果里，避免业务服务自行约定 query 字段结构。
        this.query = query;
    }

    /**
     * 返回当前页记录列表。
     *
     * @return 当前页记录列表
     */
    public List<Map<String, Object>> getRows() {
        // 返回当前页记录列表，保持旧式 store 页面仍可直接按 rows 读取表格数据。
        return rows;
    }

    /**
     * 设置当前页记录列表。
     *
     * @param rows 当前页记录列表
     */
    public void setRows(List<Map<String, Object>> rows) {
        // 把公共分页查询结果列表写入统一 rows 字段，避免各业务服务继续分散命名。
        this.rows = rows;
    }

    /**
     * 返回总记录数。
     *
     * @return 总记录数
     */
    public long getTotal() {
        // 返回当前筛选条件下的总记录数，供前端分页控件继续按旧字段 total 使用。
        return total;
    }

    /**
     * 设置总记录数。
     *
     * @param total 总记录数
     */
    public void setTotal(long total) {
        // 写入统一 total 字段，保证不同业务 store 接口对总数的返回名称不再分裂。
        this.total = total;
    }

    /**
     * 返回页码。
     *
     * @return 页码
     */
    public Integer getPageNo() {
        // 返回当前页码，供前端回显已命中的分页状态。
        return pageNo;
    }

    /**
     * 设置页码。
     *
     * @param pageNo 页码
     */
    public void setPageNo(Integer pageNo) {
        // 写入统一 pageNo 字段，保持所有 store 返回的分页状态字段口径一致。
        this.pageNo = pageNo;
    }

    /**
     * 返回每页条数。
     *
     * @return 每页条数
     */
    public Integer getPageSize() {
        // 返回当前每页条数，便于联调时确认公共分页查询实际采用的分页大小。
        return pageSize;
    }

    /**
     * 设置每页条数。
     *
     * @param pageSize 每页条数
     */
    public void setPageSize(Integer pageSize) {
        // 写入统一 pageSize 字段，避免业务服务各自定义分页大小字段名。
        this.pageSize = pageSize;
    }

    /**
     * 返回结果说明文案。
     *
     * @return 结果说明文案
     */
    public String getMsg() {
        // 返回当前 store 返回的提示文案，供浏览器页面直接显示联调状态。
        return msg;
    }

    /**
     * 设置结果说明文案。
     *
     * @param msg 结果说明文案
     */
    public void setMsg(String msg) {
        // 写入统一 msg 字段，保证不同业务 store 接口的提示信息出口一致。
        this.msg = msg;
    }
}
