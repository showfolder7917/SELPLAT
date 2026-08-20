package com.sp.selplat.aifactory.aistagerun.service.impl;

import com.sp.selplat.aifactory.aitask.service.AiTaskService;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.aifactory.aistagerun.service.AiStageRunService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** 实现服务端租约校验和状态派生，不主动调度本地进程。 */
@Service
public class AiStageRunServiceImpl implements AiStageRunService {
    private final AiTaskService taskService;

    /**
     * 注入控制面 DAO。
     * 真实传参示例：Spring 注入 AiTaskServiceImpl。
     * 真实返回示例：Service 可以执行阶段事务。
     * 异常或副作用示例：DAO 缺失时启动失败；构造过程不写数据库。
     * @param dao 控制面 DAO
     */
    public AiStageRunServiceImpl(AiTaskService taskService) { this.taskService = taskService; }

    /** {@inheritDoc} */
    @Override
    public CommonResult claim(CommonParam command) {
        String token = UUID.randomUUID().toString();
        Map<String, Object> lease = taskService.claimStage(required(command, "stageId"),
                required(command, "clientId"), token, sha256(token), Instant.now().plus(2, ChronoUnit.MINUTES));
        if (lease.isEmpty()) throw new IllegalStateException("STAGE_ALREADY_CLAIMED");
        return AiFactoryResults.success(lease, "阶段已由本地 Python 领取。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult complete(CommonParam command) {
        Object values = command.getParam("artifactDigests");
        List<String> digests = new ArrayList<>();
        if (values instanceof List<?> list) list.forEach(value -> digests.add(String.valueOf(value)));
        int exitCode = Integer.parseInt(required(command, "exitCode"));
        return AiFactoryResults.success(taskService.completeRun(required(command, "runId"), exitCode, digests),
                "执行事实已接收，等待本地文件门禁。");
    }

    private String required(CommonParam query, String key) {
        Object value = query == null ? null : query.getParam(key);
        if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(key + " 不能为空");
        return String.valueOf(value);
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("运行环境缺少 SHA-256", exception);
        }
    }
}
