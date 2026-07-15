package com.sp.selplat.common.controller;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.JsonUtils;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * 公共控制器基类用于为后续业务控制器提供统一继承入口。
 * 当前只保留业务控制器最常用的服务入口和 HTTP 验证接口，复杂辅助逻辑下沉到扩展基类。
 */
public abstract class BaseController extends BaseExtendsController {

    /**
     * 返回当前控制器绑定的服务对象。
     *
     * @return 当前控制器绑定的服务对象
     */
    public abstract BaseService getService();

    /**
     * HTTP 验证接口统一返回当前控制器装配状态和关键可访问路径。
     * 访问地址由子类类级别的 RequestMapping 前缀与当前方法路径共同组成。
     *
     * @return HTTP 验证结果
     */
    @RequestMapping(value = "/verify/http", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> verifyHttpAccess() {
        // 使用有序映射统一承接公共验证返回结构，避免每个控制器继续单独维护同一套联调 JSON 结构。
        Map<String, Object> verifyResult = new LinkedHashMap<>();
        // 写入子类提供的模块编码，方便联调方明确当前响应来自哪个业务控制器。
        verifyResult.put("moduleCode", getVerifyModuleCode());
        // 写入固定 READY 状态，表示当前控制器实例已经被 Spring 容器正常装配并可接收请求。
        verifyResult.put("controllerStatus", "READY");
        // 写入子类提供的验证说明，便于控制器按自己的业务语义描述当前开放接口。
        verifyResult.put("verifyMessage", getVerifyMessage());
        // 写入子类提供的关键访问路径列表，方便联调人员直接复制验证当前控制器已开放的 URL。
        verifyResult.put("availablePaths", getVerifyAvailablePaths());
        // 公共控制器统一把验证结构序列化成 JSON 字符串并返回，保证所有子类对外输出口径一致。
        return ResponseEntity.ok(JsonUtils.toJsonExt(verifyResult));
    }
}
