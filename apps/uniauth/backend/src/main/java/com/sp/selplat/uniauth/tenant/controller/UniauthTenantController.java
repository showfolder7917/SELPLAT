package com.sp.selplat.uniauth.tenant.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.uniauth.tenant.service.UniauthTenantService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 发布 UniauthTenant 真实表的公共 CRUD，保持一张业务表对应一个控制器。
 */
@RestController
@ModuleDescription(
        code = "uniauth-tenant",
        name = "统一认证租户",
        description = "提供统一认证租户的列表、详情、新增、更新和删除接口")
@RequestMapping("/api/uniauth/tenants")
public class UniauthTenantController extends BaseController<UniauthTenantService> {
    // 公共 CRUD 路由由 BaseController 提供，本类只声明租户表的模块坐标。
}
