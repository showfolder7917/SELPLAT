package com.sp.selplat.aifactory.aiprogressevent.service;

import com.sp.selplat.common.util.CommonResult;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** 定义只读进度查询、任务监听和 SSE 合同。 */
public interface AiProgressEventService {
    /**
     * 查询本地驱动游标后的就绪事件。
     * 真实传参示例：{@code cursor=18}。
     * 真实返回示例：{@code [{sequence:19,eventType:"stage.ready",taskId:"TASK-1"}]}。
     * 异常或副作用示例：最多返回 100 条；只读数据库。
     * @param cursor 已确认事件游标
     * @return 就绪事件统一结果
     */
    CommonResult ready(long cursor);

    /**
     * 查询任务进度快照。
     * 真实传参示例：{@code TASK-1}。
     * 真实返回示例：任务、阶段、运行、产物、Gate 和最近事件。
     * 异常或副作用示例：任务不存在时数据为空；只读数据库。
     * @param taskId 任务编码
     * @return 任务快照统一结果
     */
    CommonResult snapshot(String taskId);

    /**
     * 打开只读 SSE 进度流。
     * 真实传参示例：{@code taskId=TASK-1,lastEventId=18}。
     * 真实返回示例：先发送 snapshot 事件，随后发送变化后的 snapshot。
     * 异常或副作用示例：连接关闭后停止轮询；不会改变任务状态。
     * @param taskId 任务编码
     * @param lastEventId 客户端最后事件标识
     * @return SSE 连接
     */
    SseEmitter events(String taskId, String lastEventId);
}
