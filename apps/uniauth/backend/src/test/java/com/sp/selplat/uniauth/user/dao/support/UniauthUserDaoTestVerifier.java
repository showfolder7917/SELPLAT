package com.sp.selplat.uniauth.user.dao.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.dao.UniauthUserDaoImpl;

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
    }

    /**
     * 验证用户 DAO 实现不包装或下钻公共持久化能力。
     */
    public static void verifyImplementationBoundary() {
        // 实现类自身不得声明非合成持久化方法，JaCoCo 等工具方法不影响业务边界判断。
        assertEquals(0L, declaredBusinessMethodCount(UniauthUserDaoImpl.class));
        // 实现类必须直接继承业务层唯一允许依赖的 BaseDaoImpl 门面。
        assertEquals(BaseDaoImpl.class, UniauthUserDaoImpl.class.getSuperclass());
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
