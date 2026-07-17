package com.sp.selplat.common.service.sequence;

/**
 * 公共发号服务统一为各业务模块提供按模块编码申请主键的入口。
 */
public interface SequenceGenerator {

    /**
     * 按模块编码获取下一个主键。
     *
     * @param seqCode 模块号段编码
     * @return 下一个可用主键
     */
    Long nextId(String seqCode);
}
