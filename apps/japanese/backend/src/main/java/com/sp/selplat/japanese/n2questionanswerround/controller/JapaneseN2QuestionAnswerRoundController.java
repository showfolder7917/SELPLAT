package com.sp.selplat.japanese.n2questionanswerround.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.japanese.n2questionanswerround.service.JapaneseN2QuestionAnswerRoundService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 JapaneseN2QuestionAnswerRound 固定表公共 CRUD。 */
@RestController
@ModuleDescription(code = "japanese-n2-question-answer-round", name = "N2QuestionAnswerRound", description = "N2 用户作答轮次")
@RequestMapping(value = "/api/japanese/n2-question-answer-round/", produces = MediaType.APPLICATION_JSON_VALUE)
public class JapaneseN2QuestionAnswerRoundController extends BaseController<JapaneseN2QuestionAnswerRoundService> {
}
