package com.sp.selplat.japanese.n2questionanswerrecord.controller;

import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.japanese.n2questionanswerrecord.service.JapaneseN2QuestionAnswerRecordService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 N2 学习分页、作答、解释和新轮次组合接口。 */
@RestController
@RequestMapping(value = "/api/japanese/n2-learning-progress/", produces = MediaType.APPLICATION_JSON_VALUE)
public class JapaneseN2LearningProgressController {

    private final JapaneseN2QuestionAnswerRecordService service;

    /**
     * 创建只依赖 N2 学习进度编排服务的控制器。
     * 真实传参示例：Spring 注入 {@code JapaneseN2QuestionAnswerRecordServiceImpl}。
     * 真实返回示例：控制器可发布分页、作答、解释和新轮次四个接口。
     * 异常或副作用示例：服务缺失时应用启动失败；构造过程不访问数据库。
     *
     * @param service N2 学习进度编排服务
     */
    public JapaneseN2LearningProgressController(JapaneseN2QuestionAnswerRecordService service) {
        this.service = service;
    }

    /**
     * 返回合并当前用户进度的题目分页。
     * 真实传参示例：{@code GET getStore.htm?pageNo=1&pageSize=20}。
     * 真实返回示例：记录包含选择状态及累计正确、错误次数，不含正确答案。
     * 异常或副作用示例：查询失败时由统一异常处理器返回；不修改数据库。
     *
     * @param queryIn 题目分页和筛选字段
     * @return 分页 JSON
     */
    @GetMapping("getStore.htm")
    public String getStore(CommonPageParam queryIn) {
        return JsonUtils.toJsonIgnoreNull(service.getLearningStore(queryIn));
    }

    /**
     * 提交当前用户的一题答案。
     * 真实传参示例：{@code {questionId:100001,selectedOption:"A"}}。
     * 真实返回示例：返回正确性和累计次数。
     * 异常或副作用示例：首次作答会写入轮次和明细；非法输入不写库。
     *
     * @param answerIn 题目主键与选择
     * @return 公共结果 JSON
     */
    @PostMapping(value = "answer.htm", consumes = MediaType.APPLICATION_JSON_VALUE)
    public String answer(@RequestBody CommonParam answerIn) {
        return JsonUtils.toJsonIgnoreNull(service.answer(answerIn));
    }

    /**
     * 返回已作答题目的正确选项和解释。
     * 真实传参示例：{@code {questionId:100001}}。
     * 真实返回示例：{@code {correctOption:"A",explanation:"……"}}。
     * 异常或副作用示例：未作答时返回业务错误；不修改数据库。
     *
     * @param queryIn 题目主键
     * @return 公共结果 JSON
     */
    @PostMapping(value = "explanation.htm", consumes = MediaType.APPLICATION_JSON_VALUE)
    public String explanation(@RequestBody CommonParam queryIn) {
        return JsonUtils.toJsonIgnoreNull(service.getExplanation(queryIn));
    }

    /**
     * 结束当前轮并创建下一轮。
     * 真实传参示例：用户在页面确认后调用 {@code POST next-round.htm}。
     * 真实返回示例：返回新轮次 id 与 roundNo。
     * 异常或副作用示例：事务失败时不保留半完成轮次。
     *
     * @return 公共结果 JSON
     */
    @PostMapping("next-round.htm")
    public String nextRound() {
        return JsonUtils.toJsonIgnoreNull(service.startNextRound());
    }
}
