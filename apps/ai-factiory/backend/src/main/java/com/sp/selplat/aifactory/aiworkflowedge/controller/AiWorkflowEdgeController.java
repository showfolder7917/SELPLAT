package com.sp.selplat.aifactory.aiworkflowedge.controller;

import com.sp.selplat.aifactory.aiworkflowedge.service.AiWorkflowEdgeService;
import com.sp.selplat.common.web.controller.BaseController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布流程连线表的标准查询和维护接口。 */
@RestController
@RequestMapping("/api/v1/ai-factory/workflow-edges/")
public class AiWorkflowEdgeController extends BaseController<AiWorkflowEdgeService> { }
