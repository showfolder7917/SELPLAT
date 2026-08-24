package com.sp.selplat.aifactory.aiworkflowdefinition.controller;

import com.sp.selplat.aifactory.aiworkflowdefinition.service.AiWorkflowDefinitionService;
import com.sp.selplat.common.web.controller.BaseController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布流程定义表的标准查询和维护接口。 */
@RestController
@RequestMapping("/api/v1/ai-factory/workflow-definitions/")
public class AiWorkflowDefinitionController extends BaseController<AiWorkflowDefinitionService> { }
