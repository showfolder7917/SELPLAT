package com.sp.selplat.aifactory.airole.controller;

import com.sp.selplat.aifactory.airole.service.AiRoleService;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 AI 工厂角色编辑与上下拖拽排序接口。 */
@RestController
@RequestMapping(value = "/api/v1/ai-factory/roles", produces = MediaType.APPLICATION_JSON_VALUE)
public class AiRoleController {

    private final AiRoleService service;

    /**
     * 创建角色管理 Controller。
     * 真实传参示例：Spring 注入 {@code AiRoleServiceImpl}。
     * 真实返回示例：构造后可响应角色编辑和排序请求。
     * 异常或副作用示例：Service 缺失时应用启动失败；构造过程不访问数据库。
     *
     * @param service AiRole 表业务服务
     */
    public AiRoleController(AiRoleService service) {
        this.service = service;
    }

    /**
     * 更新一个角色的可维护业务字段。
     * 真实传参示例：{@code id=100010&roleName=需求分析师&roleType=ENGINEER&experienceLevel=INEXPERIENCED}。
     * 真实返回示例：返回 {@code {"success":true,"data":{"id":100010}}}。
     * 异常或副作用示例：非法枚举或空名称返回稳定业务错误；校验失败不写数据库。
     *
     * @param saveIn 角色主键、名称、类型、经验和专业范围
     * @return 更新结果 JSON
     */
    @PostMapping("/update.htm")
    public String update(CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(service.updateRole(saveIn));
    }

    /**
     * 删除一个通过角色树和 Agent 使用校验的普通角色。
     * 真实传参示例：{@code id=100030}。
     * 真实返回示例：返回 {@code {"success":true,"data":{"id":100030,"status":0}}}。
     * 异常或副作用示例：根节点、存在子角色或已有版本登记时返回稳定业务错误；不会物理删除。
     *
     * @param deleteIn 待删除角色主键
     * @return 角色逻辑删除结果 JSON
     */
    @PostMapping("/delete.htm")
    public String delete(CommonParam deleteIn) {
        return JsonUtils.toJsonIgnoreNull(service.deleteRole(deleteIn));
    }

    /**
     * 按页面提交的完整角色主键顺序批量保存 sortnum。
     * 真实传参示例：{@code {"items":[{"id":100010},{"id":100011}]}}。
     * 真实返回示例：返回 {@code {"success":true,"affectedRows":20}}。
     * 异常或副作用示例：缺项、重复主键或未知角色会整体拒绝，不产生部分排序。
     *
     * @param reorderIn 当前页面全部角色的目标顺序
     * @return 批量排序结果 JSON
     */
    @PostMapping("/reorder.htm")
    public String reorder(@RequestBody CommonBatchParam reorderIn) {
        return JsonUtils.toJsonIgnoreNull(service.reorderRoles(reorderIn));
    }
}
