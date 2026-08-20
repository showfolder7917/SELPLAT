package com.sp.selplat.aifactory.management.dao;

import java.util.Map;

/** 声明 AI 工厂角色、门禁、规则、项目和阶段管理页的只读聚合查询。 */
public interface AiManagementDao {

    /**
     * 查询管理页五类树表数据。
     * 真实传参示例：本方法无参数，由管理页首次加载调用。
     * 真实返回示例：{@code {roles:[{roleName:"需求分析师"}],projects:[{projectCode:"SELPLAT"}]}}。
     * 异常或副作用示例：数据库表缺失时抛出数据访问异常；只读且不推进任务状态。
     *
     * @return 角色、门禁、规则、项目和阶段执行记录
     */
    Map<String, Object> findDashboard();
}
