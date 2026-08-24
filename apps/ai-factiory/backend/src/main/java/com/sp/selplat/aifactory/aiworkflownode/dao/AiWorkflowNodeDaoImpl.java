package com.sp.selplat.aifactory.aiworkflownode.dao;

import com.sp.selplat.aifactory.common.persistence.AiFactoryBaseDao;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 把流程节点表绑定到 AI 工厂私有数据库。 */
@Repository
public class AiWorkflowNodeDaoImpl extends AiFactoryBaseDao implements AiWorkflowNodeDao {

    // 流程节点读写固定访问 AI 工厂私有库。
    private final JdbcTemplate jdbc;

    /**
     * 创建流程节点 DAO 并绑定 AI 工厂私有数据源。
     * 真实传参示例：Spring 注入 {@code aiFactoryDataSource}。
     * 真实返回示例：构造后可读写 AiWorkflowNode 表。
     * 异常或副作用示例：数据源缺失时 Spring 启动失败；构造不执行 SQL。
     *
     * @param dataSource AI 工厂私有数据源
     */
    public AiWorkflowNodeDaoImpl(@Qualifier("aiFactoryDataSource") DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findActiveByVersionId(long workflowVersionId) {
        return jdbc.queryForList(
                "SELECT * FROM AiWorkflowNode WHERE workflowVersionId=? AND status<>0 ORDER BY sortnum,id",
                workflowVersionId);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> findActiveById(long id) {
        return jdbc.queryForMap("SELECT * FROM AiWorkflowNode WHERE id=? AND status<>0", id);
    }

    /** {@inheritDoc} */
    @Override
    public int insertRoleNode(long id, long workflowVersionId, String nodeCode, String nodeName,
            long roleId, double positionX, double positionY) {
        return jdbc.update(
                "INSERT INTO AiWorkflowNode(id,workflowVersionId,nodeCode,nodeName,nodeType,roleId,"
                        + "positionX,positionY,joinPolicy,status,sortnum) VALUES(?,?,?,?,?,?,?,?,?,1,?)",
                id, workflowVersionId, nodeCode, nodeName, "ROLE", roleId,
                positionX, positionY, "ALL", id);
    }

    /** {@inheritDoc} */
    @Override
    public int move(long id, double positionX, double positionY) {
        return jdbc.update(
                "UPDATE AiWorkflowNode SET positionX=?,positionY=?,updatedAt=CURRENT_TIMESTAMP "
                        + "WHERE id=? AND status<>0",
                positionX, positionY, id);
    }
}
