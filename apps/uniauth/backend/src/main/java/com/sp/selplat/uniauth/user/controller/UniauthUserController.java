package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.common.controller.BaseController;
import com.sp.selplat.common.controller.ModuleDescription;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户控制器统一提供 store 列表、详情、新增、更新和假删除入口。
 * 访问基地址：/api/uniauth/users
 */
@RestController
@ModuleDescription(
    code = "uniauth-user",
    name = "统一认证用户",
    description = "提供统一认证用户的列表、详情、新增、更新和删除接口"
)
@RequestMapping("/api/uniauth/users")
public class UniauthUserController extends BaseController<UniauthUserService> {

    /**
     * store 列表入口用于兼容旧式 `.htm` 路由风格，把分页参数和查询条件按 Result 结构回传给调用方。
     * 访问地址：GET /api/uniauth/users/store.htm 或 POST /api/uniauth/users/store.htm
     *
     * @param requestBody JSON 请求体参数
     * @param queryIn 查询参数
     * @param request HTTP 请求
     * @return store JSON 结果
     */
    @ResponseBody
    @RequestMapping(value = "store.htm", method = {RequestMethod.GET, RequestMethod.POST}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(@RequestBody(required = false) CommonPageParam requestBody, CommonPageParam queryIn, HttpServletRequest request) {
        // 先把 JSON 请求体和普通请求参数统一合并成一个共通参数对象，保证 GET、表单 POST 和 JSON POST 都走同一条 service 链路。
        CommonPageParam finalQueryIn = resolveStoreQueryIn(requestBody, queryIn, request);
        // 控制层先调用服务层获取纯分页业务结果，再由公共控制器层统一包装旧式 store 顶层 JSON 结构。
        CommonPageResult pageResult = getService().getStore(finalQueryIn);
        // 控制层统一补齐模块编码、当前 store 路由和联调提示文案，保证 requestPath 字段只回传本接口自己的访问入口。
        return buildStoreResultJson(
            getVerifyModuleCode(),
            getVerifyAvailablePath(),
            finalQueryIn,
            pageResult,
            getVerifyMessage()
        );
    }

    /**
     * 按主键查询单个用户详情。
     * 访问地址：GET /api/uniauth/users/get.htm 或 POST /api/uniauth/users/get.htm
     *
     * @param requestBody JSON 请求体参数
     * @param queryIn 普通请求参数
     * @param request HTTP 请求
     * @return 用户详情 JSON
     */
    @ResponseBody
    @RequestMapping(value = "get.htm", method = {RequestMethod.GET, RequestMethod.POST}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getById(@RequestBody(required = false) CommonParam requestBody, CommonParam queryIn, HttpServletRequest request) {
        // 先把 JSON、表单和 query string 参数统一合并成共通入参对象，保证详情接口只有一条服务链路。
        CommonParam finalQueryIn = resolveCommonParam(requestBody, queryIn, request);
        // 服务层统一按共通入参读取主键并回传单条详情数据，控制层只负责补齐公共返回元数据。
        CommonResult result = getService().getById(finalQueryIn);
        return buildCommonResultJson(
            getVerifyModuleCode(),
            getVerifyMethodPath("getById"),
            result,
            "用户详情查询完成。"
        );
    }

    /**
     * 新增用户。
     * 访问地址：POST /api/uniauth/users/create.htm
     *
     * @param requestBody JSON 请求体参数
     * @param queryIn 普通请求参数
     * @param request HTTP 请求
     * @return 新增结果 JSON
     */
    @ResponseBody
    @RequestMapping(value = "create.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String create(@RequestBody(required = false) CommonParam requestBody, CommonParam queryIn, HttpServletRequest request) {
        // 统一把所有来源的新增字段合并到共通入参对象，避免控制层继续维护专用保存 DTO。
        CommonParam finalSaveIn = resolveCommonParam(requestBody, queryIn, request);
        // 服务层负责生成主键和整理落库字段，控制层只统一包装非分页返回结构。
        CommonResult result = getService().create(finalSaveIn);
        return buildCommonResultJson(
            getVerifyModuleCode(),
            getVerifyMethodPath("create"),
            result,
            "用户新增完成。"
        );
    }

    /**
     * 更新用户。
     * 访问地址：POST /api/uniauth/users/update.htm
     *
     * @param requestBody JSON 请求体参数
     * @param queryIn 普通请求参数
     * @param request HTTP 请求
     * @return 更新结果 JSON
     */
    @ResponseBody
    @RequestMapping(value = "update.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String update(@RequestBody(required = false) CommonParam requestBody, CommonParam queryIn, HttpServletRequest request) {
        // 统一把所有来源的更新字段合并到共通入参对象，保证更新接口按“只更新传入字段”的服务规则执行。
        CommonParam finalSaveIn = resolveCommonParam(requestBody, queryIn, request);
        // 服务层负责唯一性校验、字段筛选和更新时间维护，控制层只补公共返回元数据。
        CommonResult result = getService().update(finalSaveIn);
        return buildCommonResultJson(
            getVerifyModuleCode(),
            getVerifyMethodPath("update"),
            result,
            "用户更新完成。"
        );
    }

    /**
     * 删除用户。
     * 访问地址：POST /api/uniauth/users/delete.htm
     *
     * @param requestBody JSON 请求体参数
     * @param queryIn 普通请求参数
     * @param request HTTP 请求
     * @return 删除结果 JSON
     */
    @ResponseBody
    @RequestMapping(value = "delete.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String delete(@RequestBody(required = false) CommonParam requestBody, CommonParam queryIn, HttpServletRequest request) {
        // 统一把 JSON、表单和 query string 里的主键与操作人参数收口到共通对象，保证删除接口不再依赖专用删除 DTO。
        CommonParam finalDeleteIn = resolveCommonParam(requestBody, queryIn, request);
        // 服务层统一执行假删除并返回删除结果摘要，控制层只负责补齐共通返回结构。
        CommonResult result = getService().delete(finalDeleteIn);
        return buildCommonResultJson(
            getVerifyModuleCode(),
            getVerifyMethodPath("delete"),
            result,
            "用户删除完成。"
        );
    }
}
