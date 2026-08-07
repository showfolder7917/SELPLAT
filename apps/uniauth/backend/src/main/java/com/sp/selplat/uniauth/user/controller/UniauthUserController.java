package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 统一认证用户控制器通过公共 CRUD 基类开放列表、详情、新增、更新和假删除入口。
 * 访问基地址为 {@code /api/uniauth/users}；所有结果均由 {@link UniauthUserService} 构建后统一序列化。
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
     * 返回用户资源指定前端表格的默认列定义。
     *
     * @param viewCode 表格实例编码，例如 {@code user-management} 或 {@code user-selector}
     * @param locale 当前语言，例如 {@code zh-CN}
     * @return 表格定义 JSON，例如
     *     {@code {"success":true,"data":{"source":"DEFAULT_METADATA","resourceCode":"UniauthUser"}}}
     */
    @ResponseBody
    @RequestMapping(value = "getTableDefinition.htm", method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public String getTableDefinition(
        @RequestParam(name = "viewCode", defaultValue = "default") String viewCode,
        @RequestParam(name = "locale", defaultValue = "zh-CN") String locale
    ) {
        // Service 负责选择定义来源并构建统一结果，Controller 只执行 JSON 序列化。
        return JsonUtils.toJsonIgnoreNull(getService().getTableDefinition(viewCode, locale));
    }
}
