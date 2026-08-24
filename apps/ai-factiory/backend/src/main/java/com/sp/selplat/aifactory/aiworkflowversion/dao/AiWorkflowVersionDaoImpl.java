package com.sp.selplat.aifactory.aiworkflowversion.dao;

import com.sp.selplat.aifactory.common.persistence.AiFactoryBaseDao;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 把流程版本表绑定到 AI 工厂私有数据库。 */
@Repository
public class AiWorkflowVersionDaoImpl extends AiFactoryBaseDao implements AiWorkflowVersionDao {

    // 流程版本查询固定访问 AI 工厂私有库。
    private final JdbcTemplate jdbc;

    /**
     * 创建流程版本 DAO 并绑定 AI 工厂私有数据源。
     * 真实传参示例：Spring 注入 {@code aiFactoryDataSource}。
     * 真实返回示例：构造后可查询 AiWorkflowVersion 表。
     * 异常或副作用示例：数据源缺失时 Spring 启动失败；构造不执行 SQL。
     *
     * @param dataSource AI 工厂私有数据源
     */
    public AiWorkflowVersionDaoImpl(@Qualifier("aiFactoryDataSource") DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findLatestByWorkflowId(long workflowId) {
        return jdbc.queryForList(
                "SELECT * FROM AiWorkflowVersion WHERE workflowId=? ORDER BY versionNo DESC LIMIT 1",
                workflowId);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> findById(long id) {
        return jdbc.queryForMap("SELECT * FROM AiWorkflowVersion WHERE id=?", id);
    }
}
