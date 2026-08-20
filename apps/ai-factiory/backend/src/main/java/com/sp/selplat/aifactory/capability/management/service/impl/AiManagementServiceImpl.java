package com.sp.selplat.aifactory.capability.management.service.impl;

import com.sp.selplat.aifactory.aigate.service.AiGateService;
import com.sp.selplat.aifactory.aiproject.service.AiProjectService;
import com.sp.selplat.aifactory.airole.service.AiRoleService;
import com.sp.selplat.aifactory.airule.service.AiRuleService;
import com.sp.selplat.aifactory.aistageexecution.service.AiStageExecutionService;
import com.sp.selplat.aifactory.capability.management.service.AiManagementService;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonResult;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
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
    private final AiStageExecutionService stageService;

    /**
     * 注入五张管理表各自的业务服务。
     * 真实传参示例：Spring 注入 AiRoleServiceImpl 至 AiStageExecutionServiceImpl。
     * 真实返回示例：构造后可读取五类管理数据。
     * 异常或副作用示例：任一服务缺失时启动失败；构造不查询数据库。
     */
    public AiManagementServiceImpl(AiRoleService roleService, AiGateService gateService,
                                   AiRuleService ruleService, AiProjectService projectService,
                                   AiStageExecutionService stageService) {
        this.roleService = roleService;
        this.gateService = gateService;
        this.ruleService = ruleService;
        this.projectService = projectService;
        this.stageService = stageService;
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getDashboard() {
        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("roles", records(roleService));
        dashboard.put("gates", records(gateService));
        dashboard.put("rules", records(ruleService));
        dashboard.put("projects", records(projectService));
        List<Map<String, Object>> stages = records(stageService);
        stages.forEach(this::refreshRunningElapsed);
        dashboard.put("stages", stages);
        return AiFactoryResults.success(dashboard, "AI 工厂管理数据查询完成。");
    }

    /**
     * 按固定大页读取当前小型管理表。
     * 真实传参示例：传入 AiRoleService，表内 20 条记录。
     * 真实返回示例：返回按公共 DAO 默认顺序读取的 20 条角色。
     * 异常或副作用示例：数据库失败时向上抛出；只读当前服务对应表。
     */
    private List<Map<String, Object>> records(BaseService service) {
        CommonPageParam query = new CommonPageParam();
        query.setPageSize(1000);
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

    /**
     * 为正在运行的阶段计算当前实时耗时。
     * 真实传参示例：status=RUNNING、startedAt 为十秒前。
     * 真实返回示例：elapsedMillis 更新为约 10000。
     * 异常或副作用示例：时间为空或类型未知时保留数据库值；只修改响应映射。
     */
    private void refreshRunningElapsed(Map<String, Object> stage) {
        if (!"RUNNING".equals(String.valueOf(stage.get("status")))) {
            return;
        }
        Object startedAt = stage.get("startedAt");
        LocalDateTime started = startedAt instanceof Timestamp timestamp
                ? timestamp.toLocalDateTime()
                : startedAt instanceof LocalDateTime localDateTime ? localDateTime : null;
        if (started != null) {
            stage.put("elapsedMillis", Math.max(0, Duration.between(started, LocalDateTime.now()).toMillis()));
        }
    }
}
