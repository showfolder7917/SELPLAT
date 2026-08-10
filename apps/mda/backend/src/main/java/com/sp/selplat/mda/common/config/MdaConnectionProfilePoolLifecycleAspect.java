package com.sp.selplat.mda.common.config;

import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.mda.common.util.jdbc.JdbcConnectionFactory;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinition;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinitionResolver;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * 在连接配置成功更新或删除后统一关闭旧配置对应的目标连接池。
 * 生命周期副作用独立于空 CRUD ServiceImpl，避免连接工厂重新混入连接配置持久化职责。
 */
@Aspect
@Component
public class MdaConnectionProfilePoolLifecycleAspect {

    private static final Set<String> SINGLE_CHANGE_ACTIONS = Set.of("update", "delete");
    private static final Set<String> BATCH_CHANGE_ACTIONS = Set.of("updateBatch", "deleteBatch");
    private final ObjectProvider<MdaConnectionDefinitionResolver> definitionResolverProvider;
    private final JdbcConnectionFactory connectionFactory;

    /**
     * 创建连接配置目标池生命周期切面。
     *
     * @param definitionResolverProvider 延迟取得定义解析器，避免配置 Service 创建期间形成循环依赖
     * @param connectionFactory 目标连接池工厂，例如 {@code JdbcConnectionFactory}
     *     <p>构造完成后无返回值；副作用是保存解析器提供方和连接工厂供配置变更后使用。
     */
    public MdaConnectionProfilePoolLifecycleAspect(
            ObjectProvider<MdaConnectionDefinitionResolver> definitionResolverProvider,
            JdbcConnectionFactory connectionFactory) {
        this.definitionResolverProvider = definitionResolverProvider;
        this.connectionFactory = connectionFactory;
    }

    /**
     * 在连接配置写入成功后关闭写入前定义对应的旧目标连接池。
     *
     * @param joinPoint 连接配置 CRUD 调用，例如 {@code MdaConnectionProfileService.update}
     * @return 原 Service 真实返回值，例如 {@code {"success":true,"data":{"id":100000}}}
     * @throws Throwable 原 Service 或旧定义解析抛出的异常；失败时不会关闭已有目标池
     */
    @Around("target(com.sp.selplat.mda.connectionprofile.service.MdaConnectionProfileService)")
    public Object invalidateOldTargetPools(ProceedingJoinPoint joinPoint) throws Throwable {
        String action = joinPoint.getSignature().getName();
        List<MdaConnectionDefinition> oldDefinitions = resolveOldDefinitions(action, joinPoint.getArgs());
        Object result = joinPoint.proceed();
        oldDefinitions.forEach(connectionFactory::invalidate);
        return result;
    }

    /**
     * 根据单条或批量变更方法读取全部变更前连接定义。
     *
     * @param action Service 方法名，例如 {@code "updateBatch"}
     * @param arguments Service 原始参数，例如首项为 {@code CommonBatchParam}
     * @return 变更前连接定义列表；查询和新增方法返回空列表
     */
    private List<MdaConnectionDefinition> resolveOldDefinitions(String action, Object[] arguments) {
        if (arguments.length == 0) {
            return List.of();
        }
        if (SINGLE_CHANGE_ACTIONS.contains(action) && arguments[0] instanceof CommonParam item) {
            return List.of(resolveSavedDefinition(item));
        }
        if (BATCH_CHANGE_ACTIONS.contains(action) && arguments[0] instanceof CommonBatchParam batch) {
            List<MdaConnectionDefinition> definitions = new ArrayList<>();
            for (CommonParam item : batch.getItems()) {
                definitions.add(resolveSavedDefinition(item));
            }
            return definitions;
        }
        return List.of();
    }

    /**
     * 把 CRUD 主键参数转换为读取已保存连接所需的 connectionId 参数。
     *
     * @param item 更新或删除项，例如 {@code {"id":100000}}
     * @return 写入前目标连接定义，例如 {@code MdaConnectionDefinition[databaseType=H2]}
     */
    private MdaConnectionDefinition resolveSavedDefinition(CommonParam item) {
        CommonParam query = new CommonParam();
        query.putParam("connectionId", item == null ? null : item.getParam("id"));
        return definitionResolverProvider.getObject().resolve(query);
    }
}
