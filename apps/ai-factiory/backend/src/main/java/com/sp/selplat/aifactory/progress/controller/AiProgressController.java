package com.sp.selplat.aifactory.progress.controller;

import com.sp.selplat.aifactory.progress.service.AiProgressService;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** 发布 Python 监听、页面快照与只读 SSE 入口。 */
@RestController
@RequestMapping("/api/v1/ai-factory/progress")
public class AiProgressController {
    private final AiProgressService service;

    /**
     * 注入进度 Service。
     * 真实传参示例：Spring 注入 AiProgressServiceImpl。
     * 真实返回示例：控制器可响应 ready、snapshot 和 events。
     * 异常或副作用示例：缺少 Service 时启动失败；不推进工作流。
     * @param service 进度业务服务
     */
    public AiProgressController(AiProgressService service) { this.service = service; }

    /**
     * 返回 Python 游标后的就绪事件。
     * 真实传参示例：{@code cursor=18}。
     * 真实返回示例：标准 JSON 内含 sequence=19 的 stage.ready。
     * 异常或副作用示例：只读；Controller 只序列化。
     * @param cursor 已确认游标
     * @return Service 结果 JSON
     */
    @GetMapping(value = "/ready", produces = MediaType.APPLICATION_JSON_VALUE)
    public String ready(@RequestParam(name = "cursor", defaultValue = "0") long cursor) {
        return JsonUtils.toJsonIgnoreNull(service.ready(cursor));
    }

    /**
     * 返回任务只读快照。
     * 真实传参示例：{@code taskId=TASK-1}。
     * 真实返回示例：标准 JSON 内含 task 与 stages。
     * 异常或副作用示例：只读；Controller 只序列化。
     * @param taskId 任务编码
     * @return Service 结果 JSON
     */
    @GetMapping(value = "/snapshot", produces = MediaType.APPLICATION_JSON_VALUE)
    public String snapshot(@RequestParam(name = "taskId") String taskId) {
        return JsonUtils.toJsonIgnoreNull(service.snapshot(taskId));
    }

    /**
     * 打开任务只读 SSE 流。
     * 真实传参示例：{@code taskId=TASK-1,Last-Event-ID=18}。
     * 真实返回示例：{@code event:snapshot} 持续推送快照。
     * 异常或副作用示例：断线关闭该连接轮询线程；不改变状态。
     * @param taskId 任务编码
     * @param lastEventId 客户端最后事件标识
     * @return SSE 连接
     */
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@RequestParam(name = "taskId") String taskId,
                             @RequestHeader(name = "Last-Event-ID", required = false) String lastEventId) {
        return service.events(taskId, lastEventId);
    }
}
