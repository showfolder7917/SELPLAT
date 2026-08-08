package com.sp.selplat.common.db.sequence;

import com.sp.selplat.common.db.sequence.model.CommonSequenceSegmentRange;

/**
 * 公共号段 DAO 统一承接数据库侧抢号段动作，避免服务层直接拼接 SQL。
 */
public interface CommonSequenceSegmentDao {

    /**
     * 判断当前 DAO 绑定的项目数据库是否拥有指定启用号段。
     *
     * @param seqCode 来自主键定义的号段编码，例如 {@code "MdaConnectionProfileId"}
     * @return 当前数据库存在且启用该号段时返回 {@code true}，否则返回 {@code false}
     */
    boolean containsActiveSequence(String seqCode);

    /**
     * 按号段编码申请下一段可用主键区间。
     *
     * @param seqCode 来自主键定义且已确认归属当前数据库的号段编码，例如
     *     {@code "MdaConnectionProfileId"}
     * @return 本次成功申请到的号段，例如
     *     {@code {"startId":100001,"endId":101000,"stepSize":1000}}；若乐观锁冲突则返回 null
     */
    CommonSequenceSegmentRange allocateNextRange(String seqCode);
}
