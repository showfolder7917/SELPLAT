package com.sp.selplat.aifactory.management.service.impl;

import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.aifactory.management.dao.AiManagementDao;
import com.sp.selplat.aifactory.management.service.AiManagementService;
import com.sp.selplat.common.util.CommonResult;
import org.springframework.stereotype.Service;

/** 实现 AI 工厂管理页聚合查询，业务数据结构不进入前端静态文件。 */
@Service
public class AiManagementServiceImpl implements AiManagementService {

    private final AiManagementDao dao;

    /**
     * 注入管理聚合 DAO。
     * 真实传参示例：Spring 注入 {@code AiManagementDaoImpl}。
     * 真实返回示例：构造后的 Service 可返回五类管理数据。
     * 异常或副作用示例：DAO 缺失时 Spring 启动失败；构造过程不查询数据库。
     *
     * @param dao 管理聚合 DAO
     */
    public AiManagementServiceImpl(AiManagementDao dao) {
        this.dao = dao;
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getDashboard() {
        return AiFactoryResults.success(dao.findDashboard(), "AI 工厂管理数据查询完成。");
    }
}
