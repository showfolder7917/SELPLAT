package com.sp.selplat.aifactory.artifact.controller;

import com.sp.selplat.aifactory.artifact.service.AiArtifactService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布本地产物摘要登记入口。 */
@RestController
@RequestMapping(value = "/api/v1/ai-factory/artifacts", produces = MediaType.APPLICATION_JSON_VALUE)
public class AiArtifactController {
    private final AiArtifactService service;

    /**
     * 注入产物 Service。
     * 真实传参示例：Spring 注入 AiArtifactServiceImpl。
     * 真实返回示例：控制器可响应 register.htm。
     * 异常或副作用示例：缺少 Service 时启动失败；不读取文件。
     * @param service 产物业务服务
     */
    public AiArtifactController(AiArtifactService service) { this.service = service; }

    /**
     * 登记产物并只序列化 Service 返回。
     * 真实传参示例：{@code {taskId:"TASK-1",logicalPath:"当前任务/详细设计/A.md"}}。
     * 真实返回示例：标准产物登记 JSON。
     * 异常或副作用示例：Controller 不访问本地路径。
     * @param command 产物事实
     * @return Service 结果 JSON
     */
    @PostMapping("/register.htm")
    public String register(@RequestBody CommonParam command) { return JsonUtils.toJsonIgnoreNull(service.register(command)); }
}

