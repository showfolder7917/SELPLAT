package com.sp.selplat.common.service.sequence;

import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import java.util.Map;

/**
 * 公共发号服务统一为各业务模块提供按模块编码申请主键的入口。
 */
public interface SequenceGenerator {

    /**
     * 按模块编码获取下一个主键。
     *
     * @param seqCode 来自 DAO 主键定义的号段编码，例如 {@code "UniauthUserId"}
     * @return 下一个可用主键，例如 {@code 100001L}
     */
    Long nextId(String seqCode);

    /**
     * 按 DAO 主键号段定义生成每个主键字段对应的编号。
     *
     * @param definition DAO 提供的有序定义，例如
     *     {@code {"tenantId":"UniauthUserTenantId","orderId":"UniauthUserOrderId"}}
     * @return 单主键例如 {@code {"id":100001}}；复合主键例如
     *     {@code {"tenantId":100001,"orderId":200001}}
     */
    Map<String, Long> getSequence(IdSequenceDefinition definition);
}
