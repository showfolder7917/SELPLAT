package com.sp.selplat.aifactory.aitask.controller;

import com.sp.selplat.aifactory.aitask.service.AiTaskService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布任务创建和任务快照 HTTP 入口。 */
@RestController
@RequestMapping(value = "/api/v1/ai-factory/tasks", produces = MediaType.APPLICATION_JSON_VALUE)
public class AiTaskController {
    private final AiTaskService service;

    /**
     * 注入任务 Service。
     * 真实传参示例：Spring 注入 AiTaskServiceImpl。
     * 真实返回示例：构造后的控制器可响应任务 API。
     * 异常或副作用示例：Service 缺失时启动失败；构造过程无业务副作用。
     * @param service 任务业务服务
     */
    public AiTaskController(AiTaskService service) { this.service = service; }

    /**
     * 创建任务并只序列化 Service 返回。
     * 真实传参示例：{@code {title:"用户导入",project:"SELPLAT"}}。
     * 真实返回示例：{@code {success:true,data:{taskId:"TASK-1"}}}。
     * 异常或副作用示例：校验与落库异常由公共异常处理；Controller 不拼装业务结构。
     * @param command 通用任务参数
     * @return Service 结果 JSON
     */
    @PostMapping
    public ResponseEntity<String> createTask(@RequestBody CommonParam command) {
        return ResponseEntity.status(201).body(JsonUtils.toJsonIgnoreNull(service.createTask(command)));
    }

    /**
     * 查询任务快照并只序列化 Service 返回。
     * 真实传参示例：{@code {taskId:"TASK-1"}}。
     * 真实返回示例：{@code {success:true,data:{task:{...},stages:[...]}}}。
     * 异常或副作用示例：只读；Controller 不访问 DAO。
     * @param query 通用查询参数
     * @return Service 结果 JSON
     */
    @PostMapping("/get.htm")
    public String getTask(@RequestBody CommonParam query) {
        return JsonUtils.toJsonIgnoreNull(service.getTask(query));
    }
}
