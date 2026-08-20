package com.sp.selplat.aifactory.capability.management.service.impl;

import com.sp.selplat.aifactory.aigate.service.AiGateService;
import com.sp.selplat.aifactory.aiproject.service.AiProjectService;
import com.sp.selplat.aifactory.airole.service.AiRoleService;
import com.sp.selplat.aifactory.airule.service.AiRuleService;
import com.sp.selplat.aifactory.capability.management.service.AiManagementService;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonResult;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;
import org.springframework.stereotype.Service;

/** 通过五张表各自 Service 组装管理页只读快照。 */
@Service
public class AiManagementServiceImpl implements AiManagementService {

    private final AiRoleService roleService;
    private final AiGateService gateService;
    private final AiRuleService ruleService;
    private final AiProjectService projectService;

    /**
     * 注入五张管理表各自的业务服务。
     * 真实传参示例：Spring 注入角色、门禁、规则和项目四个服务。
     * 真实返回示例：构造后可读取四类管理数据，执行进度由流程接口独立提供。
     * 异常或副作用示例：任一服务缺失时启动失败；构造不查询数据库。
     */
    public AiManagementServiceImpl(AiRoleService roleService, AiGateService gateService,
                                   AiRuleService ruleService, AiProjectService projectService) {
        this.roleService = roleService;
        this.gateService = gateService;
        this.ruleService = ruleService;
        this.projectService = projectService;
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getDashboard() {
        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("roles", records(roleService, true));
        dashboard.put("gates", records(gateService));
        dashboard.put("rules", records(ruleService));
        dashboard.put("projects", records(projectService));
        return AiFactoryResults.success(dashboard, "AI 工厂管理数据查询完成。");
    }

    /**
     * 按固定大页读取当前小型管理表。
     * 真实传参示例：传入 AiRoleService，表内 20 条记录。
     * 真实返回示例：返回按公共 DAO 默认顺序读取的 20 条角色。
     * 异常或副作用示例：数据库失败时向上抛出；只读当前服务对应表。
     */
    private List<Map<String, Object>> records(BaseService service) {
        return records(service, false);
    }

    /**
     * 按固定大页读取管理表，并按调用方要求排除逻辑删除记录。
     * 真实传参示例：传入 AiRoleService 且 {@code activeOnly=true}。
     * 真实返回示例：返回 status=1 的角色并按 sortnum、id 排序。
     * 异常或副作用示例：表的 status 不是数字状态时调用方必须传 false；方法只读数据库。
     *
     * @param service 当前管理表业务服务
     * @param activeOnly 是否只查询启用记录
     * @return 已按业务顺序排列的管理记录
     */
    private List<Map<String, Object>> records(BaseService service, boolean activeOnly) {
        CommonPageParam query = new CommonPageParam();
        query.setPageSize(1000);
        if (activeOnly) query.putParam("status", 1);
        List<Map<String, Object>> records = service.getStore(query).getRecords();
        records.sort(Comparator
                .comparingDouble((Map<String, Object> row) -> number(row.get("sortnum")))
                .thenComparingLong(row -> (long) number(row.get("id"))));
        return records;
    }

    /**
     * 把数据库数值统一转换为管理页排序使用的 double。
     * 真实传参示例：{@code BigDecimal("10.00")}。
     * 真实返回示例：返回 {@code 10.0}。
     * 异常或副作用示例：空值或非数字返回 0；不修改原始记录。
     */
    private double number(Object value) {
        return value instanceof Number number ? number.doubleValue() : 0D;
    }

}
