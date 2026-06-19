package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import com.sp.selplat.uniauth.user.domain.out.UniauthUserHttpVerifyOut;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.util.Arrays;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户控制器当前只保留 store 兼容联调入口和 HTTP 验证入口。
 * 访问基地址：/api/uniauth/users
 */
@RestController
@RequestMapping("/api/uniauth/users")
public class UniauthUserController {

    // 用户服务当前只负责 store 兼容查询的业务编排。
    private final UniauthUserService uniauthUserService;

    /**
     * 构造用户控制器，并注入用户服务。
     *
     * @param uniauthUserService 用户服务
     */
    public UniauthUserController(UniauthUserService uniauthUserService) {
        // 保存用户服务，供验证接口和 store 接口复用。
        this.uniauthUserService = uniauthUserService;
    }

    /**
     * store 列表入口用于兼容旧式 `.htm` 路由风格，把分页参数和查询条件按 Result 结构回传给调用方。
     * 访问地址：GET /api/uniauth/users/store.htm
     *
     * @param queryIn 查询参数
     * @return store JSON 结果
     */
    @ResponseBody
    @RequestMapping(value = "store.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(UniauthUserIn queryIn) {
        // 控制层只负责接收查询参数并转发给服务层，由服务层统一组装 store JSON 结构。
        return uniauthUserService.getStore(queryIn);
    }

    /**
     * HTTP 验证接口，用于确认控制器已经加载，并把当前可访问的用户路由直接返回给联调人员。
     * 访问地址：GET /api/uniauth/users/verify/http
     *
     * @return HTTP 验证结果
     */
    @RequestMapping(value = "/verify/http", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> verifyHttpAccess() {
        // 创建验证结果对象，统一承接当前控制器装配状态和关键路由信息。
        UniauthUserHttpVerifyOut verifyOut = new UniauthUserHttpVerifyOut();
        // 写入固定模块编码，方便调用方确认当前返回来自 uniauth 用户模块。
        verifyOut.setModuleCode("uniauth-user");
        // 写入控制器已就绪状态，表示当前 HTTP 控制层已经可接收请求。
        verifyOut.setControllerStatus("READY");
        // 返回联调说明，明确当前控制器仅保留验证接口和旧式 store 兼容接口。
        verifyOut.setVerifyMessage("用户控制器已装配，当前仅保留验证接口和 store 兼容接口。");
        // 返回当前仍可访问的关键路径，方便调用方直接复制 HTTP 地址进行联调。
        verifyOut.setAvailablePaths(Arrays.asList(
            "GET /api/uniauth/users/verify/http",
            "GET /api/uniauth/users/store.htm"
        ));
        // 控制层显式把验证对象转成 JSON 字符串，统一走公共 JsonUtils 的输出规则。
        return ResponseEntity.ok(JsonUtils.toJsonExt(verifyOut));
    }
}
