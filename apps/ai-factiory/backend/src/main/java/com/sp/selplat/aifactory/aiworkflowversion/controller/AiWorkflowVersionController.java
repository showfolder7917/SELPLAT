package com.sp.selplat.aifactory.aiworkflowversion.controller;

import com.sp.selplat.aifactory.aiworkflowversion.service.AiWorkflowVersionService;
import com.sp.selplat.common.web.controller.BaseController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布流程版本表的标准查询和维护接口。 */
@RestController
@RequestMapping("/api/v1/ai-factory/workflow-versions/")
public class AiWorkflowVersionController extends BaseController<AiWorkflowVersionService> { }
