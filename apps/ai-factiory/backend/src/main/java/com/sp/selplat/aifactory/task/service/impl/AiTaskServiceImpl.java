package com.sp.selplat.aifactory.task.service.impl;

import com.sp.selplat.aifactory.common.persistence.AiFactoryControlDao;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.aifactory.task.service.AiTaskService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import org.springframework.stereotype.Service;

/** 实现任务控制面业务校验，执行动作仍由 memory 发起。 */
@Service
public class AiTaskServiceImpl implements AiTaskService {
    private final AiFactoryControlDao dao;

    /**
     * 注入控制面 DAO。
     * 真实传参示例：Spring 注入 AiFactoryControlDaoImpl。
     * 真实返回示例：构造后的 Service 可处理任务 API。
     * 异常或副作用示例：DAO 缺失时应用启动失败；不访问数据库。
     * @param dao AI 工厂控制面 DAO
     */
    public AiTaskServiceImpl(AiFactoryControlDao dao) { this.dao = dao; }

    /** {@inheritDoc} */
    @Override
    public CommonResult createTask(CommonParam command) {
        return AiFactoryResults.success(dao.createTask(command), "任务已创建，等待本地 Python 驱动。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getTask(CommonParam query) {
        return AiFactoryResults.success(dao.findTaskSnapshot(required(query, "taskId")), "任务快照查询完成。");
    }

    private String required(CommonParam query, String key) {
        Object value = query == null ? null : query.getParam(key);
        if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(key + " 不能为空");
        return String.valueOf(value);
    }
}

