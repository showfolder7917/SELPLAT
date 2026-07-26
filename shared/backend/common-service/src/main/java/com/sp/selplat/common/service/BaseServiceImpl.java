package com.sp.selplat.common.service;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

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
     * 使用前端分页参数查询当前 DAO 对应表。
     *
     * @param queryIn 前端分页参数和动态查询字段
     * @return 统一分页结果
     */
    public CommonPageResult getStore(CommonPageParam queryIn) {
        // 单独取得前端动态查询字段，避免 DAO 调用同时承担参数解析职责。
        Map<String, Object> queryColumnValueMap = queryIn.getParamMap();
        // 单独取得前端页码，明确分页入口使用的当前页。
        Integer pageNo = queryIn.getPageNo();
        // 单独取得前端每页条数，明确分页入口使用的页面容量。
        Integer pageSize = queryIn.getPageSize();
        // 公共 Service 统一调用 BaseDao 默认分页入口，让业务模块直接复用公共排序口径。
        CommonPageResult pageResult = getDao().getPageList(queryColumnValueMap, pageNo, pageSize);
        // 返回 DAO 已构建的固定分页结构，不在业务 Service 再次包装。
        return pageResult;
    }

    /**
     * 使用前端主键参数查询当前 DAO 对应的单条记录。
     *
     * @param queryIn 前端单主键或复合主键参数
     * @return 固定 CommonResult 详情结果
     */
    public CommonResult getById(CommonParam queryIn) {
        // 公共 Service 把原始主键参数交给 BaseDao，由 DAO 元数据解析单主键或复合主键。
        Map<String, Object> record = getDao().getById(queryIn);
        // 未提供完整主键或数据库未命中记录时统一返回明确业务异常。
        if (record == null) {
            throw new IllegalArgumentException("未找到对应的数据。");
        }
        // 使用固定 CommonResult 构建详情查询成功结果。
        CommonResult result = buildSuccessResult(record, "详情查询完成。");
        // 返回已经完成统一字段填充的详情结果。
        return result;
    }

    /**
     * 使用前端批量主键参数查询当前 DAO 对应的多条记录。
     *
     * @param queryIn 前端多组单主键或复合主键参数
     * @return 固定 CommonResult 批量详情结果
     */
    public CommonResult getByIds(CommonBatchParam queryIn) {
        // 公共 Service 把全部主键项一次交给 BaseDao，避免业务模块循环执行单条查询。
        List<Map<String, Object>> records = getDao().getByIds(queryIn);
        // 使用固定 CommonResult 承接 DAO 返回的记录列表。
        CommonResult result = buildSuccessResult(records, "批量详情查询完成。");
        // 返回已经完成统一字段填充的批量详情结果。
        return result;
    }

    /**
     * 为前端新增参数生成主键并写入当前 DAO 对应表。
     *
     * @param saveIn 前端新增字段
     * @return 固定 CommonResult 新增结果
     */
    public CommonResult insert(CommonParam saveIn) {
        // 根据当前 DAO 元数据取得单主键或复合主键的全部生成值。
        Map<String, Long> generatedIdMap = getSequence();
        // 把生成主键按字段名写回同一个前端参数对象，供 DAO 直接落库。
        generatedIdMap.forEach(saveIn::putParam);
        // 公共 Service 直接调用 BaseDao 新增入口，不在应用 DAO 建立同义包装方法。
        getDao().insert(saveIn);
        // 单独取得新增后的最终字段映射，供统一返回结构直接复用。
        Map<String, Object> resultData = saveIn.getParamMap();
        // 使用固定 CommonResult 构建新增成功结果。
        CommonResult result = buildSuccessResult(resultData, "新增完成。");
        // 返回包含生成主键和实际新增字段的结果。
        return result;
    }

    /**
     * 为前端批量新增参数逐项生成主键并写入当前 DAO 对应表。
     *
     * @param saveIn 前端批量新增字段
     * @return 固定 CommonResult 批量新增结果
     */
    @Transactional
    public CommonResult insertBatch(CommonBatchParam saveIn) {
        // 单独取得前端批量项，保证主键生成、DAO 调用和结果构建使用同一有序集合。
        List<CommonParam> saveItems = saveIn.getItems();
        // 逐项生成当前表需要的单主键或复合主键。
        for (CommonParam saveItem : saveItems) {
            // 根据当前 DAO 号段定义生成本项全部主键值。
            Map<String, Long> generatedIdMap = getSequence();
            // 把本项全部生成主键按字段名写回同一个参数对象。
            generatedIdMap.forEach(saveItem::putParam);
        }
        // 公共 DAO 按每组最多一千条执行真实批量新增并返回累计影响行数。
        int affectedRows = getDao().insertBatch(saveIn);
        // 使用固定 CommonResult 返回原批量项和顶层影响行数。
        CommonResult result = buildSuccessResult(saveItems, affectedRows, "批量新增完成。");
        // 返回已经完成统一字段填充的批量新增结果。
        return result;
    }

    /**
     * 使用前端主键和更新字段修改当前 DAO 对应记录。
     *
     * @param saveIn 前端主键和更新字段
     * @return 固定 CommonResult 更新结果
     */
    public CommonResult update(CommonParam saveIn) {
        // 公共 Service 直接把原始参数交给 BaseDao，由 DAO 自动分离主键条件和更新字段。
        getDao().update(saveIn);
        // 单独取得更新后的同一字段映射，保持前端参数来源可追踪。
        Map<String, Object> resultData = saveIn.getParamMap();
        // 使用固定 CommonResult 构建更新成功结果。
        CommonResult result = buildSuccessResult(resultData, "更新完成。");
        // 返回已经完成统一字段填充的更新结果。
        return result;
    }

    /**
     * 使用前端批量主键和更新字段修改当前 DAO 对应记录。
     *
     * @param saveIn 前端批量主键和更新字段
     * @return 固定 CommonResult 批量更新结果
     */
    @Transactional
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        // 单独取得前端批量项，保证 DAO 调用与最终返回使用同一有序集合。
        List<CommonParam> saveItems = saveIn.getItems();
        // 公共 DAO 按一千条分组并按更新字段结构执行真实批量更新。
        int affectedRows = getDao().updateBatch(saveIn);
        // 使用固定 CommonResult 返回原批量项和顶层影响行数。
        CommonResult result = buildSuccessResult(saveItems, affectedRows, "批量更新完成。");
        // 返回已经完成统一字段填充的批量更新结果。
        return result;
    }

    /**
     * 使用前端主键和审计字段假删除当前 DAO 对应记录。
     *
     * @param deleteIn 前端主键和审计字段
     * @return 固定 CommonResult 假删除结果
     */
    public CommonResult delete(CommonParam deleteIn) {
        // 公共 Service 只开放 BaseDao 假删除入口，由 DAO 统一补状态和更新时间。
        getDao().softDelete(deleteIn);
        // 单独取得 DAO 已补删除字段的参数映射。
        Map<String, Object> resultData = deleteIn.getParamMap();
        // 使用固定 CommonResult 构建假删除成功结果。
        CommonResult result = buildSuccessResult(resultData, "删除完成。");
        // 返回已经完成统一字段填充的假删除结果。
        return result;
    }

    /**
     * 使用前端批量主键和审计字段假删除当前 DAO 对应记录。
     *
     * @param deleteIn 前端批量主键和审计字段
     * @return 固定 CommonResult 批量假删除结果
     */
    @Transactional
    public CommonResult deleteBatch(CommonBatchParam deleteIn) {
        // 单独取得前端批量项，保证 DAO 补充的删除字段可以直接进入最终返回。
        List<CommonParam> deleteItems = deleteIn.getItems();
        // 公共 DAO 按一千条分组执行假删除并返回累计影响行数。
        int affectedRows = getDao().softDeleteBatch(deleteIn);
        // 使用固定 CommonResult 返回已补删除字段的批量项和顶层影响行数。
        CommonResult result = buildSuccessResult(deleteItems, affectedRows, "批量删除完成。");
        // 返回已经完成统一字段填充的批量假删除结果。
        return result;
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
