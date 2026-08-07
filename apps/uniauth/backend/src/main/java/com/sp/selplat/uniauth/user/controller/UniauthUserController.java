package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import org.springframework.web.bind.annotation.RequestMapping;
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
    // Grid 字段列和公共 CRUD 均由 BaseController 提供，本类只声明用户模块路径与说明。
}
