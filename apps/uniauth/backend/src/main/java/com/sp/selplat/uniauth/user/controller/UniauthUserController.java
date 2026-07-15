package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.common.controller.BaseController;
import com.sp.selplat.common.controller.ModuleDescription;
import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Enumeration;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
@ModuleDescription(
    code = "uniauth-user",
    name = "统一认证用户",
    description = "提供用户 store 查询和控制器验证接口"
)
@RequestMapping("/api/uniauth/users")
public class UniauthUserController extends BaseController{

    // 用户服务当前只负责 store 兼容查询的业务编排。
    private final UniauthUserService uniauthUserService;

    /**
     * 返回当前控制器绑定的服务对象，供公共控制器基类后续统一复用服务层入口。
     *
     * @return 当前用户服务
     */
    @Override
    public BaseService getService() {
        // 当前控制器统一返回注入的用户服务实例，保证 BaseController 子类都能按同一方式暴露服务入口。
        return uniauthUserService;
    }

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
        // 控制层只负责接收共通查询参数并转发给服务层，由服务层统一组装 store JSON 结构。
        return uniauthUserService.getStore(finalQueryIn);
    }

    /**
     * 把 JSON body、分页参数和普通请求参数统一合并成最终查询对象。
     *
     * @param requestBody JSON 请求体参数
     * @param queryIn Spring 绑定的普通请求参数
     * @param request HTTP 请求
     * @return 合并后的查询对象
     */
    private CommonPageParam resolveStoreQueryIn(CommonPageParam requestBody, CommonPageParam queryIn, HttpServletRequest request) {
        // JSON 请求体存在时优先以 JSON 对象为主，保证前端 POST application/json 提交的分页与业务字段都能直接生效。
        CommonPageParam finalQueryIn = requestBody != null ? requestBody : queryIn;
        // GET 或表单提交在没有任何对象可用时，这里补一个默认共通参数，确保后续透传链路稳定。
        if (finalQueryIn == null) {
            finalQueryIn = new CommonPageParam();
        }
        // 普通请求参数若额外带了分页值，这里继续回填到最终对象，保证 query string 和 form 参数也能覆盖默认分页口径。
        if (queryIn != null) {
            finalQueryIn.setPageNo(queryIn.getPageNo());
            finalQueryIn.setPageSize(queryIn.getPageSize());
        }
        // 再把除分页字段外的请求参数补充进动态 Map，让 JSON、GET 和表单参数最终都汇总到同一份业务字段映射里。
        populateDynamicQueryParams(finalQueryIn, request);
        // 返回已经完成多来源合并的共通参数对象，供服务层直接复用。
        return finalQueryIn;
    }

    /**
     * 把 HTTP 请求中的动态业务字段提取到共通参数对象里。
     *
     * @param queryIn 通用分页参数
     * @param request HTTP 请求
     */
    private void populateDynamicQueryParams(CommonPageParam queryIn, HttpServletRequest request) {
        // 请求对象为空时直接跳过，避免极端测试场景下控制层回填动态字段时触发空指针。
        if (queryIn == null || request == null) {
            return;
        }
        // 逐个遍历请求参数名，把分页字段之外的业务字段统一写入动态 Map，供 service 和 common-db 继续透传。
        Enumeration<String> parameterNames = request.getParameterNames();
        while (parameterNames.hasMoreElements()) {
            // 读取当前请求字段名，供后续识别分页保留字段和业务筛选字段。
            String parameterName = parameterNames.nextElement();
            // pageNo 和 pageSize 已由 Spring 直接绑定到分页基类，这里不重复写入动态 Map，避免同一语义出现双份来源。
            if ("pageNo".equals(parameterName) || "pageSize".equals(parameterName)) {
                continue;
            }
            // 读取当前字段值并写入动态 Map，让旧式 store 接口也能以通用对象承接任意筛选字段。
            queryIn.putParam(parameterName, request.getParameter(parameterName));
        }
    }
}
