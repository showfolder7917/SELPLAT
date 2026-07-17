package com.sp.selplat.common.db.sequence;

import com.sp.selplat.common.db.sequence.model.CommonSequenceSegmentRange;

/**
 * 公共号段 DAO 统一承接数据库侧抢号段动作，避免服务层直接拼接 SQL。
 */
public interface CommonSequenceSegmentDao {

    /**
     * 按号段编码申请下一段可用主键区间。
     *
     * @param seqCode 号段编码
     * @return 本次成功申请到的号段；若乐观锁冲突则返回空
     */
    CommonSequenceSegmentRange allocateNextRange(String seqCode);
}
