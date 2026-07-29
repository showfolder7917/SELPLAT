package com.sp.selplat.common.service.logging;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.ClassUtils;

/**
 * Service 操作日志切面统一记录带 OperationLog 标记的方法调用。
 * 它自动解析实际业务 Service 类名和方法名，不读取入参或返回对象，避免敏感字段进入日志。
 */
@Aspect
@Component
public class OperationLogAspect {

    // 统一操作日志使用公共切面类名，所有应用可按同一日志来源检索。
    private static final Logger LOGGER = LoggerFactory.getLogger(OperationLogAspect.class);

    /**
     * 围绕带 OperationLog 标记的 Service 方法记录一次真实业务调用。
     *
     * @param joinPoint 当前 Spring 代理调用点，例如 {@code UniauthUserServiceImpl.insertBatch}
     * @return 原 Service 方法真实返回值，例如 {@code {"success":true,"data":{"id":10001}}}
     * @throws Throwable Service 调用抛出的原始异常；全局异常处理器会继续转换页面响应
     */
    @Around("@annotation(com.sp.selplat.common.service.logging.OperationLog)")
    public Object logOperation(ProceedingJoinPoint joinPoint) throws Throwable {
        // 记录操作开始的单调时间，后续使用同一时间源计算真实耗时。
        long startedAt = System.nanoTime();
        // 解析当前代理背后去掉 Impl 后缀的业务 Service 名 → "UniauthUserService"。
        String module = resolveModuleName(joinPoint);
        // 读取实际业务方法名 → "insertBatch"，不依赖可能漂移的手写字符串。
        String action = joinPoint.getSignature().getName();
        // 入口日志只记录类名和方法名，不读取 CommonParam 或返回业务数据。
        LOGGER.info("operationStart module={} action={}", module, action);
        try {
            // 执行原始 Service 主流程，事务、DAO 调用和结果构建仍由既有基类负责。
            Object result = joinPoint.proceed();
            // 成功后记录稳定结果和耗时，供排查慢 Service 调用。
            LOGGER.info("operationEnd module={} action={} outcome=SUCCESS elapsedMs={}", module, action, elapsedMillis(startedAt));
            return result;
        } catch (Throwable exception) {
            // 失败时记录异常类型和耗时，完整堆栈由全局异常处理器统一写入一次。
            LOGGER.warn("operationEnd module={} action={} outcome=FAILED exceptionType={} elapsedMs={}", module, action, exception.getClass().getName(), elapsedMillis(startedAt));
            throw exception;
        }
    }

    /**
     * 解析代理背后的 Service 名称，并去掉实现类约定后缀。
     *
     * @param joinPoint 当前调用点，例如目标对象为 {@code UniauthUserServiceImpl}
     * @return 日志模块名，例如 {@code UniauthUserService}
     */
    private String resolveModuleName(ProceedingJoinPoint joinPoint) {
        // 取得 Spring 代理背后的真实业务实现类 → UniauthUserServiceImpl.class。
        Class<?> userClass = ClassUtils.getUserClass(joinPoint.getTarget());
        // 读取实现类简单名称 → "UniauthUserServiceImpl"。
        String simpleName = userClass.getSimpleName();
        // 以 Impl 结尾时去掉后缀 → "UniauthUserService"。
        if (simpleName.endsWith("Impl")) {
            return simpleName.substring(0, simpleName.length() - "Impl".length());
        }
        // 不符合 Impl 约定时保持真实类名，避免错误截断业务模块名。
        return simpleName;
    }

    /**
     * 将单调纳秒计时转换为日志易读的毫秒耗时。
     *
     * @param startedAt 操作开始时的 {@link System#nanoTime()} 数值
     * @return 已执行毫秒数，例如 {@code 18}
     */
    private long elapsedMillis(long startedAt) {
        // 当前单调时间减去开始时间后转为毫秒，不受系统时钟校准影响。
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
