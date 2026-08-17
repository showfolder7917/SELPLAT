package com.sp.selplat.japanese.n2questionanswerrecord.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.japanese.n2questionanswerrecord.service.JapaneseN2QuestionAnswerRecordService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 JapaneseN2QuestionAnswerRecord 固定表公共 CRUD。 */
@RestController
@ModuleDescription(code = "japanese-n2-question-answer-record", name = "N2QuestionAnswerRecord", description = "N2 用户逐题作答明细")
@RequestMapping(value = "/api/japanese/n2-question-answer-record/", produces = MediaType.APPLICATION_JSON_VALUE)
public class JapaneseN2QuestionAnswerRecordController extends BaseController<JapaneseN2QuestionAnswerRecordService> {
}
