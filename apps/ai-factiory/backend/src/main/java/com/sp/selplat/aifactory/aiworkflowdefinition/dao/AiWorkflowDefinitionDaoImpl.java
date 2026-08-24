package com.sp.selplat.aifactory.aiworkflowdefinition.dao;

import com.sp.selplat.aifactory.common.persistence.AiFactoryBaseDao;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 把流程定义表绑定到 AI 工厂私有数据库。 */
@Repository
public class AiWorkflowDefinitionDaoImpl extends AiFactoryBaseDao implements AiWorkflowDefinitionDao {

    // 流程定义查询固定访问 AI 工厂私有库，不依赖 Host 默认数据源。
    private final JdbcTemplate jdbc;

    /**
     * 创建流程定义 DAO 并绑定 AI 工厂私有数据源。
     * 真实传参示例：Spring 注入 {@code aiFactoryDataSource}。
     * 真实返回示例：构造后可查询 AiWorkflowDefinition 表。
     * 异常或副作用示例：数据源缺失时 Spring 启动失败；构造不执行 SQL。
     *
     * @param dataSource AI 工厂私有数据源
     */
    public AiWorkflowDefinitionDaoImpl(@Qualifier("aiFactoryDataSource") DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findActiveByProjectId(long projectId) {
        return jdbc.queryForList(
                "SELECT * FROM AiWorkflowDefinition WHERE projectId=? AND status<>0 ORDER BY sortnum,id",
                projectId);
    }
}
