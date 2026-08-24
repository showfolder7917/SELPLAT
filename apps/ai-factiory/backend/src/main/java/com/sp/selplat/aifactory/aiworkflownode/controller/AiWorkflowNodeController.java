package com.sp.selplat.aifactory.aiworkflownode.controller;

import com.sp.selplat.aifactory.aiworkflownode.service.AiWorkflowNodeService;
import com.sp.selplat.common.web.controller.BaseController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布流程节点表的标准查询和维护接口。 */
@RestController
@RequestMapping("/api/v1/ai-factory/workflow-nodes/")
public class AiWorkflowNodeController extends BaseController<AiWorkflowNodeService> { }
