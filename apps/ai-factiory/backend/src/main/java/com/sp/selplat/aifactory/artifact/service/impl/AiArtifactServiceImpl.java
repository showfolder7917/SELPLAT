package com.sp.selplat.aifactory.artifact.service.impl;

import com.sp.selplat.aifactory.artifact.service.AiArtifactService;
import com.sp.selplat.aifactory.common.persistence.AiFactoryControlDao;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.nio.file.Path;
import org.springframework.stereotype.Service;

/** 校验逻辑路径后登记产物事实。 */
@Service
public class AiArtifactServiceImpl implements AiArtifactService {
    private final AiFactoryControlDao dao;

    /**
     * 注入控制面 DAO。
     * 真实传参示例：Spring 注入 AiFactoryControlDaoImpl。
     * 真实返回示例：Service 可以登记产物。
     * 异常或副作用示例：DAO 缺失时启动失败；不读取任务目录。
     * @param dao 控制面 DAO
     */
    public AiArtifactServiceImpl(AiFactoryControlDao dao) { this.dao = dao; }

    /** {@inheritDoc} */
    @Override
    public CommonResult register(CommonParam command) {
        String logicalPath = required(command, "logicalPath");
        Path parsed = Path.of(logicalPath);
        if (parsed.isAbsolute() || logicalPath.contains("..") || logicalPath.contains("\\")) {
            throw new IllegalArgumentException("logicalPath 必须是任务根内的正向相对路径");
        }
        return AiFactoryResults.success(dao.registerArtifact(command), "产物摘要已登记。");
    }

    private String required(CommonParam command, String key) {
        Object value = command == null ? null : command.getParam(key);
        if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(key + " 不能为空");
        return String.valueOf(value);
    }
}

