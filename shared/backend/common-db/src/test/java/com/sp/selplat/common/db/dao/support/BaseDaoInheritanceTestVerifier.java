package com.sp.selplat.common.db.dao.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.db.dao.BaseCrudDaoImpl;
import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.dao.BaseDaoSupportImpl;
import com.sp.selplat.common.db.dao.BasePagingQueryDaoImpl;
import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 公共 DAO 继承验证器集中处理结构反射，并排除 JaCoCo 等工具生成的合成方法。
 */
public final class BaseDaoInheritanceTestVerifier {

    /**
     * 结构验证器不保存状态，只提供静态 Case 入口。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    private BaseDaoInheritanceTestVerifier() {
    }

    /**
     * 验证主键号段具体组装方法由支撑层持有且保持继承链内部可见。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     *
     * @throws AssertionError 当生产类缺少 {@code buildIdSequenceDefinition} 时抛出
     */
    public static void verifySequenceDefinitionOwner() {
        try {
            // 从支撑层自身读取真实号段定义构建方法。
            Method builderMethod = BaseDaoSupportImpl.class.getDeclaredMethod("buildIdSequenceDefinition");
            // 下沉方法必须保持 protected。
            assertTrue(Modifier.isProtected(builderMethod.getModifiers()));
        } catch (NoSuchMethodException exception) {
            // 生产方法缺失时转换成明确结构失败。
            throw new AssertionError("BaseDaoSupportImpl 缺少 buildIdSequenceDefinition", exception);
        }
    }

    /**
     * 验证数据库字段映射和 SELECT 字段串由同一支撑层提供，并彻底移除旧大小写错误方法。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     *
     * @throws AssertionError 当生产类缺少真实字段 Map 或正确驼峰 SELECT 方法时抛出
     */
    public static void verifyDatabaseColumnContract() {
        try {
            // 数据库字段能力必须返回字段名到 ColumnMetadata 的有序映射契约。
            Method columnsMapMethod = BaseDaoSupportImpl.class.getDeclaredMethod("getDbColumnsMap");
            // 字段映射作为 BaseDao 唯一公共只读元数据门面，业务层无需建立项目级平行接口。
            assertTrue(Modifier.isPublic(columnsMapMethod.getModifiers()));
            // BaseDao 必须声明同一个公开契约，强类型业务 DAO 才能直接访问。
            assertSame(java.util.Map.class, BaseDao.class.getMethod("getDbColumnsMap").getReturnType());
            // 返回原始类型必须是 Map，字段值的泛型由生产签名固定为 ColumnMetadata。
            assertSame(java.util.Map.class, columnsMapMethod.getReturnType());
            // SELECT 字段方法使用正确驼峰命名并保持 protected。
            Method selectColumnsMethod = BaseDaoSupportImpl.class.getDeclaredMethod("getSelectColumns");
            // 查询字段串只能由基础继承链调用。
            assertTrue(Modifier.isProtected(selectColumnsMethod.getModifiers()));
            // 泛型签名必须明确包含 ColumnMetadata，避免退化成无类型 Map。
            assertTrue(columnsMapMethod.getGenericReturnType().getTypeName().contains(ColumnMetadata.class.getName()));
            // 旧方法必须不存在，防止新旧字段来源继续并存。
            assertFalse(
                Arrays.stream(BaseDaoSupportImpl.class.getDeclaredMethods())
                    // 只检查生产声明的方法名。
                    .anyMatch(method -> "getselectColumns".equals(method.getName()))
            );
        } catch (NoSuchMethodException exception) {
            // 任一新契约缺失都表示重命名或字段映射下沉未完成。
            throw new AssertionError("BaseDaoSupportImpl 缺少数据库字段映射契约", exception);
        }
    }

    /**
     * 验证公共门面继承 CRUD 层并逐项实现 BaseDao 契约。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    public static void verifyFacadeContract() {
        // BaseDaoImpl 直接父类必须是 BaseCrudDaoImpl。
        assertSame(BaseCrudDaoImpl.class, BaseDaoImpl.class.getSuperclass());
        // 除支撑层直接提供的只读字段元数据外，接口和门面实现的方法签名必须逐项一致。
        Set<String> expectedFacadeMethods = declaredMethodSignatures(BaseDao.class);
        // getDbColumnsMap 由现有支撑层公开实现，BaseDaoImpl 只继承，不再增加同义包装。
        expectedFacadeMethods.remove("getDbColumnsMap()");
        // 其余 CRUD 门面继续由 BaseDaoImpl 自身唯一实现。
        assertEquals(expectedFacadeMethods, declaredMethodSignatures(BaseDaoImpl.class));
        try {
            // 公开字段元数据方法必须仍由原有支撑层实现，证明本次没有复制元数据读取逻辑。
            assertSame(
                BaseDaoSupportImpl.class,
                BaseDaoImpl.class.getMethod("getDbColumnsMap").getDeclaringClass()
            );
        } catch (NoSuchMethodException exception) {
            // 公共契约缺失时转成明确结构失败。
            throw new AssertionError("BaseDaoImpl 缺少继承的 getDbColumnsMap 公共契约", exception);
        }
    }

    /**
     * 验证 CRUD 层继承分页层但不对业务层公开 BaseDao 身份。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    public static void verifyCrudLayerBoundary() {
        // CRUD 深层直接建立在分页查询层之上。
        assertSame(BasePagingQueryDaoImpl.class, BaseCrudDaoImpl.class.getSuperclass());
        // CRUD 深层不得实现 BaseDao 公共契约。
        assertFalse(BaseDao.class.isAssignableFrom(BaseCrudDaoImpl.class));
    }

    /**
     * 验证 CRUD 深层只保存主键查询和参数辅助方法。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    public static void verifyCrudHelperBoundary() {
        // 读取非合成生产方法名，避免覆盖工具内部方法污染结构契约。
        Set<String> declaredMethodNames = Arrays.stream(BaseCrudDaoImpl.class.getDeclaredMethods())
            // 排除编译器或覆盖工具生成的方法。
            .filter(method -> !method.isSynthetic())
            // 转换成稳定方法名称。
            .map(Method::getName)
            // 收集为无顺序集合。
            .collect(Collectors.toSet());
        // CRUD 深层只允许单条主键、批量主键查询和主键参数辅助方法。
        assertEquals(
            Set.of(
                "queryById",
                "getByIdsBatchGroup",
                "resolveIdValues",
                "buildIdColumnValueMap"
            ),
            declaredMethodNames
        );
    }

    /**
     * 验证批量新增和更新的公开模板能力只由 BaseTemplateDao 持有。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     *
     * @throws AssertionError 当模板层缺少批量新增或批量更新入口时抛出
     */
    public static void verifyTemplateBatchBoundary() {
        try {
            // 模板层必须公开固定表名和当前千条分组的批量新增入口。
            BaseTemplateDao.class.getDeclaredMethod(
                "insertBatch",
                String.class,
                java.util.Map.class,
                java.util.List.class
            );
            // 模板层必须公开表名、主键元数据和当前千条分组的批量更新入口。
            BaseTemplateDao.class.getDeclaredMethod(
                "updateBatchByIds",
                String.class,
                java.util.List.class,
                java.util.Map.class,
                java.util.List.class
            );
        } catch (NoSuchMethodException exception) {
            // 任一模板批量能力缺失都表示迁移未完成。
            throw new AssertionError("BaseTemplateDao 缺少批量写入模板能力", exception);
        }
    }

    /**
     * 把类型自身非合成方法转换成包含参数类型的稳定签名集合。
     *
     * @param targetType 要读取自身声明方法的生产类型，例如 {@code BaseDao.class}
     * @return 非合成方法签名集合，例如
     *     {@code ["getById(com.sp.selplat.common.util.CommonParam)","insert(com.sp.selplat.common.util.CommonParam)"]}
     */
    private static Set<String> declaredMethodSignatures(Class<?> targetType) {
        // 只读取目标类型自身方法，避免继承方法混入门面契约。
        return Arrays.stream(targetType.getDeclaredMethods())
            // 排除 JaCoCo 等工具生成的合成方法。
            .filter(method -> !method.isSynthetic())
            // 逐项转换成稳定签名。
            .map(BaseDaoInheritanceTestVerifier::methodSignature)
            // 使用集合忽略反射返回顺序。
            .collect(Collectors.toSet());
    }

    /**
     * 生成“方法名(完整参数类型)”结构签名。
     *
     * @param method 反射读取的生产方法，例如 {@code BaseDao.getById(CommonParam)}
     * @return 稳定签名，例如 {@code "getById(com.sp.selplat.common.util.CommonParam)"}
     */
    private static String methodSignature(Method method) {
        // 参数类型按声明顺序连接，正确区分重载。
        String parameterSignature = Arrays.stream(method.getParameterTypes())
            // 完整类名避免跨包同名类型歧义。
            .map(Class::getName)
            // 多参数使用逗号连接。
            .collect(Collectors.joining(","));
        // 返回稳定方法签名。
        return method.getName() + "(" + parameterSignature + ")";
    }
}
