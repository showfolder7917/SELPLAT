package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.common.controller.BaseController;
import com.sp.selplat.common.controller.ModuleDescription;
import com.sp.selplat.common.db.query.model.CommonPageResult;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户控制器当前只保留 store 兼容联调入口和 HTTP 验证入口。
 * 访问基地址：/api/uniauth/users
 */
@RestController
@ModuleDescription(
    code = "uniauth-user",
    name = "统一认证用户",
    description = "提供用户 store 查询和控制器验证接口"
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
}
