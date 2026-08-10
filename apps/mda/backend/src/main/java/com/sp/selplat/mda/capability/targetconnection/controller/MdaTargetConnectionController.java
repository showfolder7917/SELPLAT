package com.sp.selplat.mda.capability.targetconnection.controller;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.mda.capability.targetconnection.service.MdaTargetConnectionService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 发布不落库的目标数据库连接测试能力，不承载连接配置表 CRUD。
 */
@RestController
@ModuleDescription(code = "mda-target-connection", name = "MDA 目标连接", description = "测试目标数据库连接")
@RequestMapping(value = "/api/mda/connections/", produces = MediaType.APPLICATION_JSON_VALUE)
public class MdaTargetConnectionController {

    private final MdaTargetConnectionService service;

    /**
     * 创建只依赖目标连接能力 Service 的控制器。
     *
     * @param service 目标数据库真实连接测试 Service，例如 {@code MdaTargetConnectionServiceImpl}
     *     <p>构造完成后无返回值；副作用是保存能力 Service 供连接测试接口调用。
     */
    public MdaTargetConnectionController(MdaTargetConnectionService service) {
        this.service = service;
    }

    /**
     * 测试已保存或临时连接参数。
     *
     * @param testIn JSON 请求体，例如 {@code {"connectionId":10001}}
     * @return JDBC 产品信息，例如 {@code {"success":true,"data":{"databaseProductName":"H2"}}}
     */
    @PostMapping("test.htm")
    public String test(CommonParam testIn) {
        return JsonUtils.toJsonIgnoreNull(service.testConnection(testIn));
    }
}
