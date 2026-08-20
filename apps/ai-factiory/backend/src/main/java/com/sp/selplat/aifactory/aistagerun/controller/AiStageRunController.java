package com.sp.selplat.aifactory.aistagerun.controller;

import com.sp.selplat.aifactory.aistagerun.service.AiStageRunService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布阶段领取与完成请求入口。 */
@RestController
@RequestMapping(value = "/api/v1/ai-factory/stage-runs", produces = MediaType.APPLICATION_JSON_VALUE)
public class AiStageRunController {
    private final AiStageRunService service;

    /**
     * 注入阶段 Service。
     * 真实传参示例：Spring 注入 AiStageRunServiceImpl。
     * 真实返回示例：控制器可响应 claim/complete。
     * 异常或副作用示例：缺少 Service 时启动失败；不创建本地进程。
     * @param service 阶段业务服务
     */
    public AiStageRunController(AiStageRunService service) { this.service = service; }

    /**
     * 领取阶段并只序列化 Service 返回。
     * 真实传参示例：{@code {stageId:"STAGE-1",clientId:"CLIENT-MAC-1"}}。
     * 真实返回示例：标准租约 JSON。
     * 异常或副作用示例：Controller 不生成租约。
     * @param command 领取参数
     * @return Service 结果 JSON
     */
    @PostMapping("/claim.htm")
    public String claim(@RequestBody CommonParam command) { return JsonUtils.toJsonIgnoreNull(service.claim(command)); }

    /**
     * 接收完成事实并只序列化 Service 返回。
     * 真实传参示例：{@code {runId:"RUN-1",exitCode:0,artifactDigests:[]}}。
     * 真实返回示例：{@code {status:"WAITING_FILE_GATE"}}。
     * 异常或副作用示例：Controller 不直接完成阶段。
     * @param command 完成事实
     * @return Service 结果 JSON
     */
    @PostMapping("/complete.htm")
    public String complete(@RequestBody CommonParam command) { return JsonUtils.toJsonIgnoreNull(service.complete(command)); }
}
