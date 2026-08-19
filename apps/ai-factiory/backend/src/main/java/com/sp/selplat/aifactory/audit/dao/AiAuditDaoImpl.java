package com.sp.selplat.aifactory.audit.dao;

import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 使用 AI 工厂私有数据库追加服务端审计事件。 */
@Repository
public class AiAuditDaoImpl implements AiAuditDao {
    private final JdbcTemplate jdbc;

    /**
     * 绑定 AI 工厂私有数据源。
     * 真实传参示例：Spring 注入 aiFactoryDataSource。
     * 真实返回示例：构造后可写 ai_audit_event。
     * 异常或副作用示例：数据源缺失时启动失败；构造过程不写库。
     * @param dataSource AI 工厂数据源
     */
    public AiAuditDaoImpl(@Qualifier("aiFactoryDataSource") DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** {@inheritDoc} */
    @Override
    public synchronized int append(Map<String, Object> event) {
        return jdbc.update("INSERT INTO ai_audit_event(event_code,actor_type,actor_id,action,target_type,target_id,attempt_status,previous_hash,event_hash,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)",
                event.get("eventCode"), event.get("actorType"), event.get("actorId"), event.get("action"),
                event.get("targetType"), event.get("targetId"), event.get("attemptStatus"),
                event.get("previousHash"), event.get("eventHash"), event.get("payloadJson"));
    }
}

