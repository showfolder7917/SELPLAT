package com.sp.selplat.aifactory.aiworkflowedge.dao;

import com.sp.selplat.aifactory.common.persistence.AiFactoryBaseDao;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 把流程连线表绑定到 AI 工厂私有数据库。 */
@Repository
public class AiWorkflowEdgeDaoImpl extends AiFactoryBaseDao implements AiWorkflowEdgeDao {

    // 流程连线读写固定访问 AI 工厂私有库。
    private final JdbcTemplate jdbc;

    /**
     * 创建流程连线 DAO 并绑定 AI 工厂私有数据源。
     * 真实传参示例：Spring 注入 {@code aiFactoryDataSource}。
     * 真实返回示例：构造后可读写 AiWorkflowEdge 表。
     * 异常或副作用示例：数据源缺失时 Spring 启动失败；构造不执行 SQL。
     *
     * @param dataSource AI 工厂私有数据源
     */
    public AiWorkflowEdgeDaoImpl(@Qualifier("aiFactoryDataSource") DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findActiveByVersionId(long workflowVersionId) {
        return jdbc.queryForList(
                "SELECT * FROM AiWorkflowEdge WHERE workflowVersionId=? AND status<>0 ORDER BY sortnum,id",
                workflowVersionId);
    }

    /** {@inheritDoc} */
    @Override
    public int insertSequence(long id, long workflowVersionId, long sourceNodeId, long targetNodeId) {
        return jdbc.update(
                "INSERT INTO AiWorkflowEdge(id,workflowVersionId,sourceNodeId,targetNodeId,edgeType,status,sortnum) "
                        + "VALUES(?,?,?,?,?,1,?)",
                id, workflowVersionId, sourceNodeId, targetNodeId, "SEQUENCE", id);
    }
}
