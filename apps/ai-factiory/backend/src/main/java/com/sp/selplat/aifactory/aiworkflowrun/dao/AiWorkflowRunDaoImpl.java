package com.sp.selplat.aifactory.aiworkflowrun.dao;

import com.sp.selplat.aifactory.common.persistence.AiFactoryBaseDao;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 把流程运行表绑定到 AI 工厂私有数据库。 */
@Repository
public class AiWorkflowRunDaoImpl extends AiFactoryBaseDao implements AiWorkflowRunDao {

    // 流程运行查询固定访问 AI 工厂私有库。
    private final JdbcTemplate jdbc;

    /**
     * 创建流程运行 DAO 并绑定 AI 工厂私有数据源。
     * 真实传参示例：Spring 注入 {@code aiFactoryDataSource}。
     * 真实返回示例：构造后可查询 AiWorkflowRun 表。
     * 异常或副作用示例：数据源缺失时 Spring 启动失败；构造不执行 SQL。
     *
     * @param dataSource AI 工厂私有数据源
     */
    public AiWorkflowRunDaoImpl(@Qualifier("aiFactoryDataSource") DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** {@inheritDoc} */
    @Override
    public Long findLatestIdByVersionId(long workflowVersionId) {
        return jdbc.queryForObject(
                "SELECT MAX(id) FROM AiWorkflowRun WHERE workflowVersionId=?", Long.class,
                workflowVersionId);
    }
}
