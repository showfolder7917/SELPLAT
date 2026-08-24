package com.sp.selplat.aifactory.aiworkflownoderun.controller;

import com.sp.selplat.aifactory.aiworkflownoderun.service.AiWorkflowNodeRunService;
import com.sp.selplat.common.web.controller.BaseController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布节点运行表的标准查询和维护接口。 */
@RestController
@RequestMapping("/api/v1/ai-factory/workflow-node-runs/")
public class AiWorkflowNodeRunController extends BaseController<AiWorkflowNodeRunService> { }
