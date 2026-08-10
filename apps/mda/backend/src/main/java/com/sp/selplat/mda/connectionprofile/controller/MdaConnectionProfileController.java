package com.sp.selplat.mda.connectionprofile.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.mda.connectionprofile.service.MdaConnectionProfileService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 发布 MdaConnectionProfile 固定表公共 CRUD；无状态连接测试由 capability 独立控制器承担。
 */
@RestController
@ModuleDescription(code = "mda-connection", name = "MDA 连接", description = "管理多数据库连接配置")
@RequestMapping(value = "/api/mda/connections/", produces = MediaType.APPLICATION_JSON_VALUE)
public class MdaConnectionProfileController extends BaseController<MdaConnectionProfileService> {
}
