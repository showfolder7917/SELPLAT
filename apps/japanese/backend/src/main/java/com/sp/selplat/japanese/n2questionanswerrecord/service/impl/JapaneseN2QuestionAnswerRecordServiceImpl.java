package com.sp.selplat.japanese.n2questionanswerrecord.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.japanese.n2bluebookquestion.service.JapaneseN2BlueBookQuestionService;
import com.sp.selplat.japanese.n2questionanswerrecord.dao.JapaneseN2QuestionAnswerRecordDao;
import com.sp.selplat.japanese.n2questionanswerrecord.service.JapaneseN2QuestionAnswerRecordService;
import com.sp.selplat.japanese.n2questionanswerround.service.JapaneseN2QuestionAnswerRoundService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 维护 N2 用户逐题作答明细，并始终从服务端身份派生 userId。 */
@Service
public class JapaneseN2QuestionAnswerRecordServiceImpl
        extends BaseServiceImpl<JapaneseN2QuestionAnswerRecordDao>
        implements JapaneseN2QuestionAnswerRecordService {

    private static final int HISTORY_PAGE_SIZE = 1000;
    private static final Set<String> OPTIONS = Set.of("A", "B", "C", "D");

    private final JapaneseN2BlueBookQuestionService questionService;
    private final JapaneseN2QuestionAnswerRoundService roundService;

    /**
     * 注入题目和轮次 Service，由作答记录业务统一完成学习视图编排。
     * 真实传参示例：Spring 注入题目表与作答轮次表的业务 Service。
     * 真实返回示例：构造后可把三张表的单表查询组合为学习分页。
     * 异常或副作用示例：任一 Service 缺失时应用启动失败；构造过程不访问数据库。
     *
     * @param questionService N2 题目表业务 Service
     * @param roundService 用户作答轮次业务 Service
     */
    public JapaneseN2QuestionAnswerRecordServiceImpl(
            JapaneseN2BlueBookQuestionService questionService,
            JapaneseN2QuestionAnswerRoundService roundService) {
        this.questionService = questionService;
        this.roundService = roundService;
    }

    /** {@inheritDoc} */
    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        CommonPageParam query = queryIn == null ? new CommonPageParam() : queryIn;
        query.putParam("tenantId", getCurrentTenantId());
        query.putParam("userId", getCurrentOperatorId());
        query.putParam("status", 1);
        return getDao().getPageList(
                query.getParamMap(), "answeredAt asc id asc", query.getPageNo(), query.getPageSize());
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult insert(CommonParam saveIn) {
        LocalDateTime now = LocalDateTime.now();
        // userId 由当前登录上下文决定，客户端无法为其他用户伪造作答记录。
        saveIn.putParam("userId", getCurrentOperatorId());
        putIfAbsent(saveIn, "answeredAt", now);
        putIfAbsent(saveIn, "status", 1);
        putIfAbsent(saveIn, "sortnum", 0);
        putIfAbsent(saveIn, "createdAt", now);
        putIfAbsent(saveIn, "updatedAt", now);
        return super.insert(saveIn);
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findAllForCurrentUser() {
        List<Map<String, Object>> records = new ArrayList<>();
        int pageNo = 1;
        while (true) {
            CommonPageParam query = new CommonPageParam();
            query.setPageNo(pageNo);
            query.setPageSize(HISTORY_PAGE_SIZE);
            CommonPageResult page = getStore(query);
            records.addAll(page.getRecords());
            if (records.size() >= page.getTotalCount() || page.getRecords().isEmpty()) break;
            pageNo++;
        }
        return List.copyOf(records);
    }

    /** {@inheritDoc} */
    @Override
    public CommonPageResult getLearningStore(CommonPageParam queryIn) {
        CommonPageResult page = questionService.getStore(queryIn == null ? new CommonPageParam() : queryIn);
        Map<String, Object> currentRound = roundService.findCurrentRound();
        String currentRoundId = currentRound.isEmpty() ? "" : text(currentRound.get("id"));
        Map<String, AnswerSummary> summaries = summarize(findAllForCurrentUser(), currentRoundId);
        List<Map<String, Object>> safeRecords = new ArrayList<>();
        for (Map<String, Object> source : page.getRecords()) {
            Map<String, Object> record = new LinkedHashMap<>(source);
            AnswerSummary summary = summaries.getOrDefault(text(record.get("id")), new AnswerSummary());
            // 管理页记录保留完整可编辑字段，表格是否展示正确答案由表头 visible 配置独立控制。
            record.put("selectedOption", summary.selectedOption);
            record.put("answerCorrect", summary.answerCorrect);
            record.put("correctCount", summary.correctCount);
            record.put("wrongCount", summary.wrongCount);
            record.put("currentRoundId", currentRound.get("id"));
            record.put("currentRoundNo", currentRound.isEmpty() ? 1 : currentRound.get("roundNo"));
            safeRecords.add(record);
        }
        page.setRecords(safeRecords);
        return page;
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(transactionManager = "japaneseTransactionManager")
    public CommonResult answer(CommonParam answerIn) {
        long questionId = requiredLong(answerIn, "questionId");
        String selectedOption = text(answerIn.getParam("selectedOption")).toUpperCase(Locale.ROOT);
        if (!OPTIONS.contains(selectedOption)) {
            throw new CommonBusinessException("JAPANESE_ANSWER_OPTION_INVALID", "请选择 A、B、C 或 D。");
        }
        Map<String, Object> question = question(questionId);
        Map<String, Object> round = roundService.findCurrentRound();
        if (round.isEmpty()) round = roundService.startNextRound();
        String roundId = text(round.get("id"));
        List<Map<String, Object>> history = findAllForCurrentUser();
        // 当前点击与题库正确选项实时比较，禁止复用同题第一次作答结果。
        boolean correct = selectedOption.equalsIgnoreCase(text(question.get("correctOption")));
        CommonParam create = new CommonParam();
        create.putParam("roundId", round.get("id"));
        create.putParam("questionId", questionId);
        create.putParam("selectedOption", selectedOption);
        create.putParam("correctFlag", correct);
        // 每次有效点击都新增明细，累计次数等于用户真实选对和选错的次数。
        insert(create);
        Map<String, Object> createdRecord = new LinkedHashMap<>();
        createdRecord.put("roundId", round.get("id"));
        createdRecord.put("questionId", questionId);
        createdRecord.put("selectedOption", selectedOption);
        createdRecord.put("correctFlag", correct);
        history = new ArrayList<>(history);
        history.add(createdRecord);
        AnswerSummary summary = summarize(history, roundId).get(text(questionId));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("questionId", questionId);
        data.put("roundId", round.get("id"));
        data.put("roundNo", round.get("roundNo"));
        data.put("selectedOption", selectedOption);
        data.put("correct", correct);
        data.put("correctCount", summary == null ? 0 : summary.correctCount);
        data.put("wrongCount", summary == null ? 0 : summary.wrongCount);
        return success(data, correct ? "回答正确。" : "回答错误。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getExplanation(CommonParam queryIn) {
        long questionId = requiredLong(queryIn, "questionId");
        boolean answered = findAllForCurrentUser().stream()
                .anyMatch(record -> text(questionId).equals(text(record.get("questionId"))));
        if (!answered) {
            throw new CommonBusinessException("JAPANESE_QUESTION_NOT_ANSWERED", "请先选择答案，再查看解释。");
        }
        Map<String, Object> question = question(questionId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("questionId", questionId);
        data.put("correctOption", question.get("correctOption"));
        data.put("explanation", question.get("explanation"));
        return success(data, "题目解释读取完成。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult startNextRound() {
        return success(roundService.startNextRound(), "新一轮已开始，历史正确和错误次数已保留。");
    }

    private Map<String, Object> question(long questionId) {
        CommonParam query = new CommonParam();
        query.putParam("id", questionId);
        Object data = questionService.getById(query).getData();
        Map<String, Object> question = new LinkedHashMap<>();
        if (data instanceof Map<?, ?> map) map.forEach((key, value) -> question.put(String.valueOf(key), value));
        return question;
    }

    private Map<String, AnswerSummary> summarize(List<Map<String, Object>> records, String currentRoundId) {
        Map<String, AnswerSummary> summaries = new LinkedHashMap<>();
        for (Map<String, Object> record : records) {
            String questionId = text(record.get("questionId"));
            AnswerSummary summary = summaries.computeIfAbsent(questionId, ignored -> new AnswerSummary());
            boolean correct = truth(record.get("correctFlag"));
            if (correct) summary.correctCount++; else summary.wrongCount++;
            if (currentRoundId.equals(text(record.get("roundId")))) {
                summary.selectedOption = text(record.get("selectedOption"));
                summary.answerCorrect = correct;
            }
        }
        return summaries;
    }

    private long requiredLong(CommonParam input, String field) {
        Object value = input == null ? null : input.getParam(field);
        try {
            long parsed = value instanceof Number number ? number.longValue() : Long.parseLong(text(value));
            if (parsed > 0) return parsed;
        } catch (NumberFormatException ignored) {
            // 统一转换为稳定业务错误，不把 Java 数字解析异常暴露给页面。
        }
        throw new CommonBusinessException("JAPANESE_QUESTION_ID_INVALID", "题目主键不能为空且必须为正整数。");
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private boolean truth(Object value) {
        return value instanceof Boolean bool ? bool
                : value instanceof Number number ? number.intValue() != 0
                : "true".equalsIgnoreCase(text(value));
    }

    private CommonResult success(Object data, String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setModuleCode("japanese-n2-learning-progress");
        result.setData(data);
        result.setMsg(message);
        return result;
    }

    private void putIfAbsent(CommonParam target, String key, Object value) {
        if (target.getParam(key) == null) target.putParam(key, value);
    }

    /** 当前用户对单题的累计次数和当前轮选择。 */
    private static final class AnswerSummary {
        private String selectedOption = "";
        private Boolean answerCorrect;
        private int correctCount;
        private int wrongCount;
    }
}
