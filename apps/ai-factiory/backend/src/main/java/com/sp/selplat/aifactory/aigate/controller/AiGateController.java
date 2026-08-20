package com.sp.selplat.aifactory.aigate.controller;

import com.sp.selplat.aifactory.aigate.service.AiGateService;
import com.sp.selplat.common.web.controller.BaseController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布唯一 AI 门禁登记的标准查询、新增、修改和逻辑删除接口。 */
@RestController
@RequestMapping("/api/v1/ai-factory/gates/")
public class AiGateController extends BaseController<AiGateService> { }
