package com.sp.selplat.common.service;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.util.CommonResult;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;

// 公共服务实现统一持有 DAO、发号器和标准结果构建能力，业务子类只保留自身必要的业务编排。
public abstract class BaseServiceImpl<D extends BaseDao> implements BaseService {

    // 当前业务 DAO 由 Spring 按子类声明的泛型类型注入，避免每个 ServiceImpl 重复声明 DAO 字段和构造函数。
    @Autowired
    private D dao;
    // 公共发号器由基础 Service 统一注入，避免每个需要新增数据的业务 Service 重复保存同一依赖。
    @Autowired
    private SequenceGenerator sequenceGenerator;

    /**
     * 返回当前业务 Service 绑定的强类型 DAO 门面。
     *
     * @return 当前业务对应的 DAO 接口实例
     */
    protected D getDao() {
        // 统一返回 Spring 已按业务 Service 泛型注入的 DAO，子类只能通过 BaseDao 公开契约访问持久层。
        return dao;
    }

    /**
     * 按当前业务 DAO 的主键号段定义生成全部主键字段值。
     *
     * @return 按 DAO 主键顺序保存的“字段名 → Long”映射
     */
    protected Map<String, Long> getSequence() {
        // 当前 DAO 负责提供单主键或复合主键定义，公共发号器负责生成可直接回填的字段值。
        return sequenceGenerator.getSequence(getDao().getIdSequenceDefinition());
    }

    /**
     * 构建非分页接口统一使用的成功结果。
     *
     * @param data 直接对外返回的业务数据
     * @param message 当前业务动作的结果说明
     * @return 字段固定的 CommonResult
     */
    protected CommonResult buildSuccessResult(Object data, String message) {
        // CommonResult 是非分页接口唯一允许使用的固定返回类型，基础 Service 统一设置成功标记。
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
     * @param data 直接对外返回的业务数据
     * @param affectedRows DAO 累计影响行数
     * @param message 当前写入动作的结果说明
     * @return 带顶层 affectedRows 的固定 CommonResult
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
