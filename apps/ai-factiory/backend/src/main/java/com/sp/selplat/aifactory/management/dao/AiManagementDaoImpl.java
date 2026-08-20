package com.sp.selplat.aifactory.management.dao;

import java.util.LinkedHashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 使用 AI 工厂私有数据库读取管理树表，不在 DAO 中拼装页面组件。 */
@Repository
public class AiManagementDaoImpl implements AiManagementDao {

    private final JdbcTemplate jdbc;

    /**
     * 绑定 AI 工厂私有数据源。
     * 真实传参示例：Spring 注入 {@code aiFactoryDataSource}。
     * 真实返回示例：构造完成后可读取 {@code AiRole} 等管理表。
     * 异常或副作用示例：数据源缺失时应用启动失败；构造过程不执行 SQL。
     *
     * @param dataSource AI 工厂私有数据源
     */
    public AiManagementDaoImpl(@Qualifier("aiFactoryDataSource") DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> findDashboard() {
        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("roles", jdbc.queryForList(
                "SELECT id,parentId,roleCode,roleName,roleType,experienceLevel,codexPoolType,specialty,status,sortnum "
                        + "FROM AiRole WHERE status<>0 ORDER BY sortnum,id"));
        dashboard.put("gates", jdbc.queryForList(
                "SELECT id,parentId,gateCode,gateName,gateType,projectCode,description,status,sortnum "
                        + "FROM AiGate WHERE status<>0 ORDER BY sortnum,id"));
        dashboard.put("rules", jdbc.queryForList(
                "SELECT id,parentId,ruleCode,ruleName,ruleScope,projectCode,logicalPath,status,sortnum "
                        + "FROM AiRule WHERE status<>0 ORDER BY sortnum,id"));
        dashboard.put("projects", jdbc.queryForList(
                "SELECT id,parentId,projectCode,projectName,currentStage,currentWork,progressPercent,status,sortnum,updatedAt "
                        + "FROM AiProject WHERE status<>'DELETED' ORDER BY sortnum,id"));
        dashboard.put("stages", jdbc.queryForList(
                "SELECT id,projectId,parentId,stageCode,stageName,status,startedAt,endedAt,"
                        + "CASE WHEN status='RUNNING' AND startedAt IS NOT NULL "
                        + "THEN DATEDIFF('MILLISECOND',startedAt,CURRENT_TIMESTAMP) ELSE elapsedMillis END AS elapsedMillis,"
                        + "currentWork,localLogPath,slowReason,sortnum FROM AiStageExecution ORDER BY projectId,sortnum,id"));
        return dashboard;
    }
}
