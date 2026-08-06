package com.sp.selplat.mda.connection.controller;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.mda.connection.service.MdaConnectionProfileService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * 连接配置接口只负责接收公共参数并序列化 Service 固定结果。
 */
@RestController
@ModuleDescription(code = "mda-connection", name = "MDA 连接", description = "管理多数据库连接配置")
@RequestMapping("/api/mda/connections")
public class MdaConnectionProfileController extends BaseController<MdaConnectionProfileService> {

    /**
     * 测试已保存连接或页面尚未保存的连接参数，并返回真实 JDBC 产品信息。
     *
     * @param testIn JSON 请求体；已保存连接例如 {@code {"connectionId":10001}}，未保存连接例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_test","username":"sa"}}
     * @return 连接测试 JSON，例如
     *     {@code {"success":true,"data":{"databaseProductName":"H2","driverName":"H2 JDBC Driver",}
     *     {@code "readOnly":false},"msg":"连接成功。"}}
     */
    @RequestMapping(value = "test.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String test(@RequestBody CommonParam testIn) {
        // 连接读取、解密和 JDBC 验证均由 Service 完成，控制器只序列化固定结果。
        return JsonUtils.toJsonIgnoreNull(getService().testConnection(testIn));
    }
}
