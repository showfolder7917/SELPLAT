package com.sp.selplat.aifactory.aiworkflowrun.controller;

import com.sp.selplat.aifactory.aiworkflowrun.service.AiWorkflowRunService;
import com.sp.selplat.common.web.controller.BaseController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布流程运行表的标准查询和维护接口。 */
@RestController
@RequestMapping("/api/v1/ai-factory/workflow-runs/")
public class AiWorkflowRunController extends BaseController<AiWorkflowRunService> { }
