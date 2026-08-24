package com.sp.selplat.aifactory.aiworkflownode.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 标记 AiWorkflowNode 流程节点表的公共持久化契约。 */
public interface AiWorkflowNodeDao extends BaseDao {

    /**
     * 查询一个流程版本中的启用节点。
     * 真实传参示例：版本主键 {@code 150001L}。
     * 真实返回示例：{@code [{id:160001,nodeName:"需求分析师",roleId:100010}]}。
     * 异常或副作用示例：没有节点时返回空列表；方法只读。
     *
     * @param workflowVersionId 流程版本主键
     * @return 启用节点记录
     */
    List<Map<String, Object>> findActiveByVersionId(long workflowVersionId);

    /**
     * 查询一个启用节点。
     * 真实传参示例：节点主键 {@code 160001L}。
     * 真实返回示例：{@code {id:160001,workflowVersionId:150001,nodeCode:"ROLE_160001"}}。
     * 异常或副作用示例：节点不存在时底层查询抛出异常；方法只读。
     *
     * @param id 节点主键
     * @return 节点记录
     */
    Map<String, Object> findActiveById(long id);

    /**
     * 新增一个角色流程节点。
     * 真实传参示例：{@code id=160001, workflowVersionId=150001, roleId=100010}。
     * 真实返回示例：返回受影响行数 {@code 1}。
     * 异常或副作用示例：主键或版本约束冲突时抛出数据访问异常；事务回滚。
     *
     * @param id 节点主键
     * @param workflowVersionId 流程版本主键
     * @param nodeCode 节点稳定编码
     * @param nodeName 节点名称
     * @param roleId 角色主键
     * @param positionX 横坐标
     * @param positionY 纵坐标
     * @return 受影响行数
     */
    int insertRoleNode(long id, long workflowVersionId, String nodeCode, String nodeName,
            long roleId, double positionX, double positionY);

    /**
     * 保存节点坐标。
     * 真实传参示例：{@code id=160001, positionX=120.5, positionY=80.0}。
     * 真实返回示例：节点存在时返回 {@code 1}。
     * 异常或副作用示例：节点不存在时返回 {@code 0}；不新增记录。
     *
     * @param id 节点主键
     * @param positionX 横坐标
     * @param positionY 纵坐标
     * @return 受影响行数
     */
    int move(long id, double positionX, double positionY);
}
