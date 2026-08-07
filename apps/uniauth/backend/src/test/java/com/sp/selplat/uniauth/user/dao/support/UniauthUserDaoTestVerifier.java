package com.sp.selplat.uniauth.user.dao.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.uniauth.persistence.UniauthBaseDao;
import com.sp.selplat.uniauth.persistence.UniauthTableMetadataDao;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.dao.UniauthUserDaoImpl;
import java.lang.reflect.Modifier;

/**
 * 用户 DAO 结构验证器集中承接边界断言，让测试方法只表达被检查的生产类型。
 */
public final class UniauthUserDaoTestVerifier {

    /**
     * 验证器不保存状态，只允许通过静态入口检查 DAO 继承边界。
     */
    private UniauthUserDaoTestVerifier() {
    }

    /**
     * 验证用户 DAO 接口不重新声明任何模块专用持久化方法。
     */
    public static void verifyInterfaceBoundary() {
        // 接口自身不得声明非合成业务方法，覆盖工具加入的合成方法不属于生产持久化契约。
        assertEquals(0L, declaredBusinessMethodCount(UniauthUserDao.class));
        // 用户 DAO 必须继续属于 BaseDao 契约。
        assertTrue(BaseDao.class.isAssignableFrom(UniauthUserDao.class));
        // 用户 DAO 同时继承 Uniauth 项目级表格元数据契约，不在具体接口重复声明方法。
        assertTrue(UniauthTableMetadataDao.class.isAssignableFrom(UniauthUserDao.class));
    }

    /**
     * 验证用户 DAO 实现不包装或下钻公共持久化能力。
     */
    public static void verifyImplementationBoundary() {
        // 实现类自身不得声明非合成持久化方法，JaCoCo 等工具方法不影响业务边界判断。
        assertEquals(0L, declaredBusinessMethodCount(UniauthUserDaoImpl.class));
        // 具体 DAO 必须直接继承 Uniauth 项目基类，禁止各 DAO 重复选择数据源。
        assertEquals(UniauthBaseDao.class, UniauthUserDaoImpl.class.getSuperclass());
        // Uniauth 项目基类必须继续继承公共 BaseDaoImpl，保持全部公共 CRUD 契约不变。
        assertEquals(BaseDaoImpl.class, UniauthBaseDao.class.getSuperclass());
        try {
            // Spring 使用 CGLIB 代理 DAO，对外持久化方法不得使用 final 阻断代理和已注入上下文。
            assertFalse(Modifier.isFinal(UniauthBaseDao.class
                .getDeclaredMethod("getDefaultTableDefinition", String.class, String.class)
                .getModifiers()));
        } catch (NoSuchMethodException exception) {
            // 方法契约缺失时转为明确的结构断言失败。
            throw new AssertionError("UniauthBaseDao 缺少默认表格定义方法。", exception);
        }
    }

    /**
     * 统计生产类型自己声明的非合成方法，隔离覆盖工具在字节码中加入的内部方法。
     *
     * @param targetType 待检查的生产类型，例如 {@code UniauthUserDaoImpl.class}
     * @return 非合成业务方法数量，例如空实现 DAO 返回 {@code 0L}
     */
    private static long declaredBusinessMethodCount(Class<?> targetType) {
        // 读取目标类型声明的方法并排除编译器或覆盖工具生成的合成入口。
        return java.util.Arrays.stream(targetType.getDeclaredMethods())
            // 只保留真实 Java 源码对应的业务方法。
            .filter(method -> !method.isSynthetic())
            // 返回可直接用于 DAO 空边界断言的方法数量。
            .count();
    }
}
