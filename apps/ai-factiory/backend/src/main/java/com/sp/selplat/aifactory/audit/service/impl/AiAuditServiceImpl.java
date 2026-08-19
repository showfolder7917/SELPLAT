package com.sp.selplat.aifactory.audit.service.impl;

import com.sp.selplat.aifactory.audit.dao.AiAuditDao;
import com.sp.selplat.aifactory.audit.service.AiAuditService;
import com.sp.selplat.common.util.JsonUtils;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.stereotype.Service;

/** 为服务端 API 事实建立进程内顺序哈希链。 */
@Service
public class AiAuditServiceImpl implements AiAuditService {
    private final AiAuditDao dao;
    private final AtomicReference<String> previousHash = new AtomicReference<>("SERVER-GENESIS");

    /**
     * 注入审计 DAO。
     * 真实传参示例：Spring 注入 AiAuditDaoImpl。
     * 真实返回示例：Service 可以追加服务端审计。
     * 异常或副作用示例：DAO 缺失时启动失败；构造过程不写审计。
     * @param dao 审计 DAO
     */
    public AiAuditServiceImpl(AiAuditDao dao) { this.dao = dao; }

    /** {@inheritDoc} */
    @Override
    public synchronized void recordHttpAttempt(String clientId, String method, String path,
                                               int status, String requestId) {
        String prior = previousHash.get();
        Map<String, Object> payload = Map.of("requestId", requestId, "httpStatus", status);
        String eventHash = sha256(prior + "|" + clientId + "|" + method + "|" + path + "|" + status + "|" + requestId);
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventCode", "AUD-" + UUID.randomUUID().toString().replace("-", ""));
        event.put("actorType", "LOCAL_PYTHON_CLIENT");
        event.put("actorId", clientId);
        event.put("action", "HTTP_" + method);
        event.put("targetType", "API");
        event.put("targetId", path);
        event.put("attemptStatus", status < 400 ? "SUCCESS" : "FAILED");
        event.put("previousHash", prior);
        event.put("eventHash", eventHash);
        event.put("payloadJson", JsonUtils.toJsonIgnoreNull(payload));
        dao.append(event);
        previousHash.set(eventHash);
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("运行环境缺少 SHA-256", exception);
        }
    }
}

