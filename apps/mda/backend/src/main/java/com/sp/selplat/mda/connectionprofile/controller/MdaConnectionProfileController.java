package com.sp.selplat.mda.connectionprofile.controller;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.mda.connectionprofile.service.MdaConnectionProfileService;
import com.sp.selplat.mda.targetdatabase.connection.service.MdaTargetConnectionService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 发布 MdaConnectionProfile 固定表公共 CRUD，并只保留连接测试这一项业务扩展入口。
 */
@RestController
@ModuleDescription(code = "mda-connection", name = "MDA 连接", description = "管理多数据库连接配置")
@RequestMapping(value = "/api/mda/connections/", produces = MediaType.APPLICATION_JSON_VALUE)
public class MdaConnectionProfileController extends BaseController<MdaConnectionProfileService> {

    private final MdaTargetConnectionService targetConnectionService;

    /**
     * 创建只把连接测试委托给目标数据库 Service 的连接配置控制器。
     *
     * @param targetConnectionService 目标数据库真实连接测试 Service，例如 {@code MdaTargetConnectionServiceImpl}
     *     <p>构造完成后无返回值；公共 CRUD Service 仍由 {@link BaseController} 按泛型统一注入。
     */
    public MdaConnectionProfileController(MdaTargetConnectionService targetConnectionService) {
        this.targetConnectionService = targetConnectionService;
    }

    /**
     * 测试已保存或临时连接参数。
     *
     * @param testIn JSON 请求体，例如 {@code {"connectionId":10001}}
     * @return JDBC 产品信息，例如 {@code {"success":true,"data":{"databaseProductName":"H2"}}}
     */
    @PostMapping("test.htm")
    public String test(CommonParam testIn) {
        return JsonUtils.toJsonIgnoreNull(targetConnectionService.testConnection(testIn));
    }
}
