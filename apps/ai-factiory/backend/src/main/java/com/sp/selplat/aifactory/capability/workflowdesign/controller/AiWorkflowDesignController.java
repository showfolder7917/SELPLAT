package com.sp.selplat.aifactory.capability.workflowdesign.controller;

import com.sp.selplat.aifactory.capability.workflowdesign.service.AiWorkflowDesignService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 发布流程画布定义接口；不在 Java 端启动任何 Agent。 */
@RestController
@RequestMapping(value="/api/v1/ai-factory/workflows", produces=MediaType.APPLICATION_JSON_VALUE)
public class AiWorkflowDesignController {
    private final AiWorkflowDesignService service;

    /**
     * 创建流程设计控制器。
     * 真实传参示例：Spring 注入 AiWorkflowDesignServiceImpl。
     * 真实返回示例：构造后发布画布查询和编辑接口。
     * 异常或副作用示例：依赖缺失时启动失败；构造不访问数据库。
     * @param service 流程设计服务
     */
    public AiWorkflowDesignController(AiWorkflowDesignService service) { this.service = service; }

    /**
     * 查询项目当前流程画布和节点进度。
     * 真实传参示例：{@code projectId=130001}。
     * 真实返回示例：返回含三个角色节点和两条连线的 JSON。
     * 异常或副作用示例：项目无流程时返回空画布；方法不启动 Agent。
     * @param projectId 项目主键
     * @return 流程快照 JSON
     */
    @GetMapping("/snapshot")
    public String snapshot(@RequestParam("projectId") long projectId) { return JsonUtils.toJsonIgnoreNull(service.snapshot(projectId)); }

    /**
     * 把一个允许的角色作为独立实例加入指定流程版本。
     * 真实传参示例：{@code workflowVersionId=160000&roleId=100015&positionX=100&positionY=80}。
     * 真实返回示例：返回新节点主键和 ROLE_ 稳定编码。
     * 异常或副作用示例：旧角色或不存在的版本被拒绝；成功时写入一个节点。
     * @param workflowVersionId 流程版本主键
     * @param roleId 角色主键
     * @param positionX 画布横坐标
     * @param positionY 画布纵坐标
     * @return 新节点结果 JSON
     */
    @PostMapping("/nodes/create.htm")
    public String addNode(@RequestParam("workflowVersionId") long workflowVersionId,
                          @RequestParam("roleId") long roleId,
                          @RequestParam("positionX") double positionX,
                          @RequestParam("positionY") double positionY) {
        CommonParam command=new CommonParam();
        command.putParam("workflowVersionId",workflowVersionId);
        command.putParam("roleId",roleId);
        command.putParam("positionX",positionX);
        command.putParam("positionY",positionY);
        return JsonUtils.toJsonIgnoreNull(service.addRoleNode(command));
    }

    /**
     * 保存现有节点在画布中的新坐标。
     * 真实传参示例：{@code id=170001&positionX=320&positionY=180}。
     * 真实返回示例：返回已移动节点主键。
     * 异常或副作用示例：节点不存在时返回业务错误；不推进工作流。
     * @param id 节点主键
     * @param positionX 新横坐标
     * @param positionY 新纵坐标
     * @return 移动结果 JSON
     */
    @PostMapping("/nodes/move.htm")
    public String moveNode(@RequestParam("id") long id,
                           @RequestParam("positionX") double positionX,
                           @RequestParam("positionY") double positionY) {
        CommonParam command=new CommonParam();
        command.putParam("id",id);
        command.putParam("positionX",positionX);
        command.putParam("positionY",positionY);
        return JsonUtils.toJsonIgnoreNull(service.moveNode(command));
    }

    /**
     * 在同一流程版本的两个节点之间新增有向连线。
     * 真实传参示例：{@code sourceNodeId=170001&targetNodeId=170002}。
     * 真实返回示例：返回新连线主键。
     * 异常或副作用示例：自连或跨版本连接被拒绝；成功时写入一条顺序边。
     * @param sourceNodeId 来源节点主键
     * @param targetNodeId 目标节点主键
     * @return 新连线结果 JSON
     */
    @PostMapping("/edges/create.htm")
    public String addEdge(@RequestParam("sourceNodeId") long sourceNodeId,
                          @RequestParam("targetNodeId") long targetNodeId) {
        CommonParam command=new CommonParam();
        command.putParam("sourceNodeId",sourceNodeId);
        command.putParam("targetNodeId",targetNodeId);
        return JsonUtils.toJsonIgnoreNull(service.addEdge(command));
    }
}
