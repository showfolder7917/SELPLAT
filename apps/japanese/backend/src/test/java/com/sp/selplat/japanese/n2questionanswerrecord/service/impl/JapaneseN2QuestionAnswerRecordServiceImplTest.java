package com.sp.selplat.japanese.n2questionanswerrecord.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.japanese.n2bluebookquestion.service.JapaneseN2BlueBookQuestionService;
import com.sp.selplat.japanese.n2questionanswerrecord.service.JapaneseN2QuestionAnswerRecordService;
import com.sp.selplat.japanese.n2questionanswerround.service.JapaneseN2QuestionAnswerRoundService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/** 验证每次选择都使用当前选项重新判定，并形成独立作答记录。 */
class JapaneseN2QuestionAnswerRecordServiceImplTest {

    /**
     * 验证管理列表保留编辑窗口所需的正确答案与解释，列显隐只由表头配置控制。
     * 真实传参示例：题目页记录包含 correctOption=C、explanation=完整解释。
     * 真实返回示例：学习列表同一记录仍包含 correctOption=C 和完整解释。
     * 异常或副作用示例：测试只组装内存分页结果，不访问数据库，也不暴露额外详情请求。
     */
    @Test
    void shouldKeepHiddenEditableFieldsInManagementRecord() {
        JapaneseN2BlueBookQuestionService questionService = Mockito.mock(
                JapaneseN2BlueBookQuestionService.class);
        JapaneseN2QuestionAnswerRoundService roundService = Mockito.mock(
                JapaneseN2QuestionAnswerRoundService.class);
        JapaneseN2QuestionAnswerRecordServiceImpl service = Mockito.spy(
                new JapaneseN2QuestionAnswerRecordServiceImpl(questionService, roundService));
        CommonPageResult questionPage = new CommonPageResult();
        questionPage.setRecords(List.of(Map.of(
                "id", 100001L,
                "correctOption", "C",
                "explanation", "完整解释")));
        questionPage.setTotalCount(1);
        questionPage.setPageNo(1);
        questionPage.setPageSize(20);
        when(questionService.getStore(any(CommonPageParam.class))).thenReturn(questionPage);
        when(roundService.findCurrentRound()).thenReturn(Map.of());
        doReturn(List.of()).when(service).findAllForCurrentUser();

        CommonPageResult result = service.getLearningStore(new CommonPageParam());

        assertThat(result.getRecords()).singleElement()
                .satisfies(record -> assertThat(record)
                        .containsEntry("correctOption", "C")
                        .containsEntry("explanation", "完整解释"));
    }

    /**
     * 验证同一轮同一题先选错再选对时，错误和正确次数各自增加一次。
     * 真实传参示例：题目正确答案为 B，依次提交 A、B。
     * 真实返回示例：第一次返回 wrongCount=1，第二次返回 correctCount=1、wrongCount=1。
     * 异常或副作用示例：每次有效点击都会调用一次明细表 insert；测试使用模拟 Service，不访问数据库。
     */
    @Test
    void shouldJudgeAndPersistEveryClickForTheSameQuestion() {
        JapaneseN2BlueBookQuestionService questionService = Mockito.mock(
                JapaneseN2BlueBookQuestionService.class);
        JapaneseN2QuestionAnswerRoundService roundService = Mockito.mock(
                JapaneseN2QuestionAnswerRoundService.class);
        JapaneseN2QuestionAnswerRecordServiceImpl service = Mockito.spy(
                new JapaneseN2QuestionAnswerRecordServiceImpl(questionService, roundService));

        CommonResult questionResult = new CommonResult();
        questionResult.setSuccess(true);
        questionResult.setData(Map.of("id", 100001L, "correctOption", "B"));
        when(questionService.getById(any(CommonParam.class))).thenReturn(questionResult);
        when(roundService.findCurrentRound()).thenReturn(Map.of("id", 100000L, "roundNo", 1));
        doReturn(List.of(), List.of(Map.of(
                        "roundId", 100000L,
                        "questionId", 100001L,
                        "selectedOption", "A",
                        "correctFlag", false)))
                .when(service).findAllForCurrentUser();
        doReturn(new CommonResult()).when(service).insert(any(CommonParam.class));

        CommonResult wrongResult = service.answer(answer(100001L, "A"));
        CommonResult correctResult = service.answer(answer(100001L, "B"));

        assertThat(data(wrongResult)).containsEntry("correct", false)
                .containsEntry("correctCount", 0)
                .containsEntry("wrongCount", 1);
        assertThat(data(correctResult)).containsEntry("correct", true)
                .containsEntry("correctCount", 1)
                .containsEntry("wrongCount", 1);

        ArgumentCaptor<CommonParam> inserts = ArgumentCaptor.forClass(CommonParam.class);
        verify(service, times(2)).insert(inserts.capture());
        assertThat(inserts.getAllValues())
                .extracting(value -> value.getParam("selectedOption"))
                .containsExactly("A", "B");
        assertThat(inserts.getAllValues())
                .extracting(value -> value.getParam("correctFlag"))
                .containsExactly(false, true);
    }

    /**
     * 创建一次真实作答入参。
     * 真实传参示例：{@code answer(100001,"B")}。
     * 真实返回示例：参数包含 questionId=100001、selectedOption=B。
     * 异常或副作用示例：只创建内存参数，不访问数据库。
     *
     * @param questionId 题目主键
     * @param selectedOption 当前点击选项
     * @return 可传给学习进度 Service 的公共参数
     */
    private CommonParam answer(long questionId, String selectedOption) {
        CommonParam input = new CommonParam();
        input.putParam("questionId", questionId);
        input.putParam("selectedOption", selectedOption);
        return input;
    }

    /**
     * 将公共结果中的学习进度数据转换为断言映射。
     * 真实传参示例：{@code CommonResult.data={correct:true}}。
     * 真实返回示例：返回包含 correct、correctCount、wrongCount 的映射。
     * 异常或副作用示例：结果契约不是映射时测试立即失败，不产生外部副作用。
     *
     * @param result 学习进度公共结果
     * @return 结果中的业务映射
     */
    private Map<String, Object> data(CommonResult result) {
        assertThat(result.getData()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.getData();
        return data;
    }
}
