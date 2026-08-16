package com.sp.selplat.common.web.controller;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * 为采用公共数据维护协议的业务控制器统一提供分页、详情、新增、更新和假删除 HTTP 入口。
 * 子类只声明类级访问前缀和强类型 Service；业务结果由 Service 构建，本类只负责 JSON 序列化。
 *
 * @param <S> 当前业务控制器对应的 CRUD Service，例如 {@code UniauthUserService}
 */
public abstract class BaseController<S extends BaseService> extends BaseExtendsController {

    // Spring 按子类泛型注入唯一 CRUD Service，避免每个业务控制器重复声明同义字段。
    @Autowired
    protected S service;

    /**
     * 返回当前控制器绑定的强类型 CRUD Service，供公共入口和业务扩展入口调用。
     *
     * @return Spring 注入的业务 Service，例如 {@code UniauthUserService} 代理
     */
    protected S getService() {
        // 只暴露已注入对象，不在控制器层创建或包装 Service。
        return service;
    }

    /**
     * 返回当前业务资源指定 Grid 的默认字段列元数据。
     *
     * @param viewCode Grid 实例编码，例如 {@code user-management}
     * @param locale 当前语言，例如 {@code zh-CN}
     * @return Grid 字段列 JSON，例如
     *     {@code {"success":true,"data":{"source":"DEFAULT_METADATA","viewCode":"user-management"}}}
     */
    @ResponseBody
    @RequestMapping(value = "getGridColumn.htm", params = "!tableCode", method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String getGridColumn(
        @RequestParam(name = "viewCode", defaultValue = "default") String viewCode,
        @RequestParam(name = "locale", defaultValue = "zh-CN") String locale
    ) {
        // Service 负责字段来源和业务异常，公共 Controller 只执行一次 JSON 序列化。
        return JsonUtils.toJsonIgnoreNull(getService().getGridColumn(viewCode, locale));
    }

    /**
     * 通过引用数据表格唯一 code 返回当前业务资源的 Grid 列配置。
     * 真实传参示例：{@code tableCode=table101020&locale=zh-CN}。
     * 真实返回示例：返回 {@code {"source":"REFERENCE_DATA_TABLE_ELEMENT","columns":[...]}}。
     * 异常或副作用示例：tableCode 为空时由 BaseService 返回统一业务异常；方法不修改数据库。
     *
     * @param tableCode ReferenceDataTable 的后端生成唯一 code，例如 {@code table101020}
     * @param locale 当前语言，例如 {@code zh-CN}
     * @return 引用数据配置优先、数据库字段名静默后备的 Grid 列 JSON
     */
    @ResponseBody
    @RequestMapping(value = "getGridColumn.htm", params = "tableCode", method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String getGridColumnByTableCode(
        @RequestParam(name = "tableCode") String tableCode,
        @RequestParam(name = "locale", defaultValue = "zh-CN") String locale
    ) {
        // Reference Data 用 tableCode 定位唯一 Grid，响应也删除旧 viewCode 名称，避免与元素视图混淆。
        CommonResult result = getService().getGridColumn(tableCode, locale);
        if (result.getData() instanceof Map<?, ?> original) {
            Map<String, Object> data = new LinkedHashMap<>();
            original.forEach((key, value) -> data.put(String.valueOf(key), value));
            data.remove("viewCode");
            data.put("tableCode", tableCode);
            result.setData(data);
        }
        return JsonUtils.toJsonIgnoreNull(result);
    }

    /**
     * 按分页和筛选条件查询当前业务列表。
     *
     * @param queryIn 查询字符串或表单分页参数，例如 {@code pageNo=1&pageSize=10&status=1}
     * @return 分页 JSON，例如
     *     {@code {"records":[{"id":1}],"totalCount":1,"pageNo":1,"pageSize":10}}
     */
    @ResponseBody
    @RequestMapping(value = "getStore.htm", method = {RequestMethod.GET, RequestMethod.POST},
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(CommonPageParam queryIn) {
        // Service 已返回完整分页结构，控制器只执行一次 JSON 序列化。
        return JsonUtils.toJsonIgnoreNull(getService().getStore(queryIn));
    }

    /**
     * 按单主键或复合主键查询当前业务详情。
     *
     * @param queryIn 查询字符串或表单主键参数，例如 {@code id=10001}
     * @return 详情 JSON，例如 {@code {"success":true,"data":{"id":10001}}}
     */
    @ResponseBody
    @RequestMapping(value = "getById.htm", method = {RequestMethod.GET, RequestMethod.POST},
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String getById(CommonParam queryIn) {
        // Service 已返回完整详情结构，控制器不增加响应字段。
        return JsonUtils.toJsonIgnoreNull(getService().getById(queryIn));
    }

    /**
     * 按多组主键批量查询当前业务详情。
     *
     * @param queryIn JSON 请求体中的多组主键，例如 {@code {"items":[{"id":1},{"id":2}]}}
     * @return 批量详情 JSON，例如 {@code {"success":true,"data":[{"id":1},{"id":2}]}}
     */
    @ResponseBody
    @RequestMapping(value = "getByIds.htm", method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String getByIds(@RequestBody CommonBatchParam queryIn) {
        // 批量查询结果完全来自 Service，控制器只序列化。
        return JsonUtils.toJsonIgnoreNull(getService().getByIds(queryIn));
    }

    /**
     * 新增一条当前业务记录。
     *
     * @param saveIn 查询字符串或表单新增字段，例如 {@code loginName=admin&displayName=管理员}
     * @return 新增 JSON，例如 {@code {"success":true,"data":{"id":10001,"loginName":"admin"}}}
     */
    @ResponseBody
    @RequestMapping(value = "create.htm", method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String insert(CommonParam saveIn) {
        // 发号、校验和落库均由 Service 完成，控制器只序列化最终结果。
        return JsonUtils.toJsonIgnoreNull(getService().insert(saveIn));
    }

    /**
     * 批量新增当前业务记录。
     *
     * @param saveIn JSON 请求体中的新增项，例如 {@code {"items":[{"loginName":"admin"}]}}
     * @return 批量新增 JSON，例如 {@code {"success":true,"affectedRows":1}}
     */
    @ResponseBody
    @RequestMapping(value = "insertBatch.htm", method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String insertBatch(@RequestBody CommonBatchParam saveIn) {
        // Service 负责事务和批处理，控制器只序列化完整结果。
        return JsonUtils.toJsonIgnoreNull(getService().insertBatch(saveIn));
    }

    /**
     * 按主键更新一条当前业务记录。
     *
     * @param saveIn 查询字符串或表单主键与更新字段，例如 {@code id=10001&displayName=系统管理员}
     * @return 更新 JSON，例如 {@code {"success":true,"data":{"id":10001,"displayName":"系统管理员"}}}
     */
    @ResponseBody
    @RequestMapping(value = "update.htm", method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String update(CommonParam saveIn) {
        // Service 已返回更新结果，控制器不做第二次包装。
        return JsonUtils.toJsonIgnoreNull(getService().update(saveIn));
    }

    /**
     * 批量更新当前业务记录。
     *
     * @param saveIn JSON 请求体中的主键与更新字段，例如 {@code {"items":[{"id":1,"status":0}]}}
     * @return 批量更新 JSON，例如 {@code {"success":true,"affectedRows":1}}
     */
    @ResponseBody
    @RequestMapping(value = "updateBatch.htm", method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String updateBatch(@RequestBody CommonBatchParam saveIn) {
        // Service 负责事务和批处理，控制器只序列化完整结果。
        return JsonUtils.toJsonIgnoreNull(getService().updateBatch(saveIn));
    }

    /**
     * 按主键假删除一条当前业务记录。
     *
     * @param deleteIn 查询字符串或表单主键，例如 {@code id=10001}；审计身份由 Service 补齐
     * @return 假删除 JSON，例如 {@code {"success":true,"data":{"id":10001,"status":0}}}
     */
    @ResponseBody
    @RequestMapping(value = "delete.htm", method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String delete(CommonParam deleteIn) {
        // Service 只执行假删除并返回完整结果，控制器不开放物理删除能力。
        return JsonUtils.toJsonIgnoreNull(getService().delete(deleteIn));
    }

    /**
     * 批量假删除当前业务记录。
     *
     * @param deleteIn JSON 请求体中的多组主键与审计字段，例如 {@code {"items":[{"id":1},{"id":2}]}}
     * @return 批量假删除 JSON，例如 {@code {"success":true,"affectedRows":2}}
     */
    @ResponseBody
    @RequestMapping(value = "deleteBatch.htm", method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String deleteBatch(@RequestBody CommonBatchParam deleteIn) {
        // Service 负责事务和批处理，控制器只序列化完整结果。
        return JsonUtils.toJsonIgnoreNull(getService().deleteBatch(deleteIn));
    }
}
