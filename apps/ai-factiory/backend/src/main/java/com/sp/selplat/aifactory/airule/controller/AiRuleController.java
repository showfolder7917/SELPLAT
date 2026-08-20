package com.sp.selplat.aifactory.airule.controller;

import com.sp.selplat.aifactory.airule.service.AiRuleService;
import com.sp.selplat.common.web.controller.BaseController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布项目规则登记的标准查询、新增、修改和逻辑删除接口。 */
@RestController
@RequestMapping("/api/v1/ai-factory/rules/")
public class AiRuleController extends BaseController<AiRuleService> { }
