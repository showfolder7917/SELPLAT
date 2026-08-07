package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.uniauth.user.dao.support.UniauthUserDaoTestVerifier;
import org.junit.jupiter.api.Test;

/**
 * 用户 DAO 边界测试只声明接口和实现两个结构 Case，具体断言集中到独立验证器。
 */
class UniauthUserDaoBoundaryTest {

    /**
     * interface-boundary Case 验证业务 DAO 接口只继承 BaseDao 公共能力。
     */
    @Test
    void interfaceBoundary() {
        UniauthUserDaoTestVerifier.verifyInterfaceBoundary();
    }

    /**
     * implementation-boundary Case 验证业务 DAO 通过 Uniauth 项目基类继承 BaseDaoImpl 门面。
     */
    @Test
    void implementationBoundary() {
        UniauthUserDaoTestVerifier.verifyImplementationBoundary();
    }
}
