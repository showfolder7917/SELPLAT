package com.sp.selplat.common.service;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.util.CommonResult;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 为上层基础 Service 提供主键发号和固定结果构建能力。
 * 本层不承载公开 CRUD，数据库调用统一由 {@link BaseServiceImpl} 通过 {@link BaseDao} 门面完成。
 *
 * @param <D> 当前业务 Service 对应的 BaseDao 子接口，例如 {@code UniauthUserDao}
 */
public abstract class BaseExtendsServiceImpl<D extends BaseDao> {

    // 公共发号器由扩展基础层统一注入，避免 BaseServiceImpl 和各业务 Service 重复保存同一依赖。
    @Autowired
    private SequenceGenerator sequenceGenerator;

    /**
     * 由上层 BaseServiceImpl 提供当前业务绑定的强类型 DAO。
     *
     * @return 当前业务对应的 DAO 门面，例如 {@code UniauthUserDao} 代理
     */
    protected abstract D getDao();

    /**
     * 按当前业务 DAO 的主键号段定义生成全部主键字段值。
     *
     * @return 单主键例如 {@code {"id":100001}}；复合主键例如
     *     {@code {"tenantId":100001,"orderId":200001}}
     */
    protected Map<String, Long> getSequence() {
        // 当前 DAO 负责提供单主键或复合主键定义，公共发号器负责生成可直接回填的字段值。
        return sequenceGenerator.getSequence(getDao().getIdSequenceDefinition());
    }

    /**
     * 构建非分页接口统一使用的成功结果。
     *
     * @param data 直接对外返回的业务数据，例如 {@code {"id":1,"loginName":"admin"}}
     * @param message 当前业务动作的结果说明，例如 {@code "详情查询完成。"}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":{"id":1,"loginName":"admin"},"msg":"详情查询完成。"}}
     */
    protected CommonResult buildSuccessResult(Object data, String message) {
        // CommonResult 是非分页接口唯一允许使用的固定返回类型，扩展基础层统一设置成功标记。
        CommonResult result = new CommonResult();
        // data 直接承接业务记录或批量 items，禁止业务 Service 为附加信息再包一层 Map。
        result.setData(data);
        // msg 保存业务动作说明，控制层只负责序列化且不得再次覆盖。
        result.setMsg(message);
        // 当前公共构建入口只用于成功结果，因此统一在返回前设置成功状态。
        result.setSuccess(true);
        // 返回完整固定结构供业务 Service 直接交给 Controller。
        return result;
    }

    /**
     * 构建包含数据库影响行数的写入成功结果。
     *
     * @param data 直接对外返回的业务数据，例如 {@code [{"id":1},{"id":2}]}
     * @param affectedRows DAO 累计影响行数，例如 {@code 2}
     * @param message 当前写入动作的结果说明，例如 {@code "批量更新完成。"}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":[{"id":1},{"id":2}],"affectedRows":2,"msg":"批量更新完成。"}}
     */
    protected CommonResult buildSuccessResult(Object data, int affectedRows, String message) {
        // 先复用标准成功结果入口，保证 success、data 和 msg 的构建口径完全一致。
        CommonResult result = buildSuccessResult(data, message);
        // 写入统计只进入 CommonResult 顶层字段，不改变 data 的业务数据层级。
        result.setAffectedRows(affectedRows);
        // 返回固定 CommonResult，业务 Service 不再自行扩展响应结构。
        return result;
    }
}
