package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.dao.support.BaseDaoInheritanceTestVerifier;
import org.junit.jupiter.api.Test;

// 公共 DAO 继承边界测试只声明结构 Case，反射读取和断言统一放入独立验证器。
class BaseDaoInheritanceTest {

    // sequence-definition-owner Case 验证号段组装逻辑位于支撑层。
    @Test
    void sequenceDefinitionOwner() {
        BaseDaoInheritanceTestVerifier.verifySequenceDefinitionOwner();
    }

    // facade-contract Case 验证 BaseDao 和 BaseDaoImpl 一一对应。
    @Test
    void facadeContract() {
        BaseDaoInheritanceTestVerifier.verifyFacadeContract();
    }

    // crud-layer-boundary Case 验证 CRUD 深层不履行公共 BaseDao 契约。
    @Test
    void crudLayerBoundary() {
        BaseDaoInheritanceTestVerifier.verifyCrudLayerBoundary();
    }

    // crud-helper-boundary Case 验证 CRUD 深层只保留主键内部辅助方法。
    @Test
    void crudHelperBoundary() {
        BaseDaoInheritanceTestVerifier.verifyCrudHelperBoundary();
    }

    // template-batch-boundary Case 验证真实批量新增和更新能力已经归属模板层。
    @Test
    void templateBatchBoundary() {
        BaseDaoInheritanceTestVerifier.verifyTemplateBatchBoundary();
    }
}
