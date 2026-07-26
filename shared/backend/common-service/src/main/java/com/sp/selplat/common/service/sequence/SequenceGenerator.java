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
     * @param seqCode 模块号段编码
     * @return 下一个可用主键
     */
    Long nextId(String seqCode);

    /**
     * 按 DAO 主键号段定义生成每个主键字段对应的编号。
     *
     * @param definition 包含每个主键字段独立号段编码的有序定义
     * @return 按 DAO 主键顺序保存的“字段名 → Long”映射
     */
    Map<String, Long> getSequence(IdSequenceDefinition definition);
}
