package com.sp.selplat.japanese.n2questionanswerround.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.japanese.n2questionanswerround.dao.JapaneseN2QuestionAnswerRoundDao;
import com.sp.selplat.japanese.n2questionanswerround.service.JapaneseN2QuestionAnswerRoundService;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 维护 N2 用户作答轮次，并始终从服务端身份派生 userId。 */
@Service
public class JapaneseN2QuestionAnswerRoundServiceImpl
        extends BaseServiceImpl<JapaneseN2QuestionAnswerRoundDao>
        implements JapaneseN2QuestionAnswerRoundService {

    /** {@inheritDoc} */
    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        CommonPageParam query = queryIn == null ? new CommonPageParam() : queryIn;
        // 用户归属只能取当前服务端身份，前端同名条件不得越权读取他人轮次。
        query.putParam("tenantId", getCurrentTenantId());
        query.putParam("userId", getCurrentOperatorId());
        query.putParam("status", 1);
        return getDao().getPageList(
                query.getParamMap(), "roundNo desc id desc", query.getPageNo(), query.getPageSize());
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult insert(CommonParam saveIn) {
        LocalDateTime now = LocalDateTime.now();
        // userId 与审计身份使用同一服务端用户，禁止客户端把轮次登记给其他人。
        saveIn.putParam("userId", getCurrentOperatorId());
        putIfAbsent(saveIn, "roundStatus", "IN_PROGRESS");
        putIfAbsent(saveIn, "startedAt", now);
        putIfAbsent(saveIn, "status", 1);
        putIfAbsent(saveIn, "sortnum", 0);
        putIfAbsent(saveIn, "createdAt", now);
        putIfAbsent(saveIn, "updatedAt", now);
        return super.insert(saveIn);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> findCurrentRound() {
        CommonPageParam query = new CommonPageParam();
        query.setPageSize(1);
        query.putParam("roundStatus", "IN_PROGRESS");
        CommonPageResult page = getStore(query);
        return page.getRecords().isEmpty() ? Map.of() : page.getRecords().get(0);
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(transactionManager = "japaneseTransactionManager")
    public Map<String, Object> startNextRound() {
        LocalDateTime now = LocalDateTime.now();
        Map<String, Object> current = findCurrentRound();
        if (!current.isEmpty()) {
            CommonParam finish = new CommonParam();
            finish.putParam("id", current.get("id"));
            finish.putParam("roundStatus", "COMPLETED");
            finish.putParam("completedAt", now);
            finish.putParam("updatedAt", now);
            super.update(finish);
        }
        CommonPageParam latestQuery = new CommonPageParam();
        latestQuery.setPageSize(1);
        CommonPageResult latest = getStore(latestQuery);
        int nextRoundNo = latest.getRecords().isEmpty()
                ? 1 : number(latest.getRecords().get(0).get("roundNo")) + 1;
        CommonParam create = new CommonParam();
        create.putParam("roundNo", nextRoundNo);
        return copyData(insert(create).getData());
    }

    private void putIfAbsent(CommonParam target, String key, Object value) {
        if (target.getParam(key) == null) target.putParam(key, value);
    }

    private int number(Object value) {
        return value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value));
    }

    private Map<String, Object> copyData(Object data) {
        Map<String, Object> copy = new LinkedHashMap<>();
        if (data instanceof Map<?, ?> map) map.forEach((key, value) -> copy.put(String.valueOf(key), value));
        return copy;
    }
}
