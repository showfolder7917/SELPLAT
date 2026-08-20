package com.sp.selplat.aifactory.aiprogressevent.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sp.selplat.aifactory.aitask.service.AiTaskService;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.aifactory.aiprogressevent.service.AiProgressEventService;
import com.sp.selplat.common.util.CommonResult;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** 实现只读进度快照与 SSE 推送。 */
@Service
public class AiProgressEventServiceImpl implements AiProgressEventService {
    private final AiTaskService taskService;
    private final ObjectMapper objectMapper;

    /**
     * 注入控制面 DAO 与公共 JSON 读取器。
     * 真实传参示例：Spring 注入 AiTaskServiceImpl 和 ObjectMapper。
     * 真实返回示例：Service 可查询并推送只读进度。
     * 异常或副作用示例：依赖缺失时启动失败；构造过程不创建线程。
     * @param dao 控制面 DAO
     * @param objectMapper Spring JSON 读取器
     */
    public AiProgressEventServiceImpl(AiTaskService taskService, ObjectMapper objectMapper) {
        this.taskService = taskService;
        this.objectMapper = objectMapper;
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult ready(long cursor) {
        List<Map<String, Object>> output = new ArrayList<>();
        for (Map<String, Object> source : taskService.findReadyEvents(cursor, 100)) {
            Map<String, Object> event = new LinkedHashMap<>(source);
            Object json = event.remove("payloadJson");
            try {
                event.put("payload", json == null ? Map.of() : objectMapper.readValue(String.valueOf(json),
                        new TypeReference<Map<String, Object>>() { }));
            } catch (IOException exception) {
                throw new IllegalStateException("进度事件 payload 无法解析", exception);
            }
            output.add(event);
        }
        return AiFactoryResults.success(output, "就绪阶段事件查询完成。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult snapshot(String taskId) {
        if (taskId == null || taskId.isBlank()) throw new IllegalArgumentException("taskId 不能为空");
        return AiFactoryResults.success(taskService.findTaskSnapshot(taskId), "进度快照查询完成。");
    }

    /** {@inheritDoc} */
    @Override
    public SseEmitter events(String taskId, String lastEventId) {
        if (taskId == null || taskId.isBlank()) throw new IllegalArgumentException("taskId 不能为空");
        SseEmitter emitter = new SseEmitter(0L);
        ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "aifactory-sse-" + taskId);
            thread.setDaemon(true);
            return thread;
        });
        AtomicBoolean closed = new AtomicBoolean(false);
        Runnable close = () -> {
            if (closed.compareAndSet(false, true)) executor.shutdownNow();
        };
        emitter.onCompletion(close);
        emitter.onTimeout(close);
        emitter.onError(error -> close.run());
        executor.scheduleWithFixedDelay(() -> {
            if (closed.get()) return;
            try {
                emitter.send(SseEmitter.event().name("snapshot")
                        .id(String.valueOf(System.currentTimeMillis())).data(snapshot(taskId)));
            } catch (IOException | IllegalStateException exception) {
                close.run();
                emitter.completeWithError(exception);
            }
        }, 0, 2, TimeUnit.SECONDS);
        return emitter;
    }
}
