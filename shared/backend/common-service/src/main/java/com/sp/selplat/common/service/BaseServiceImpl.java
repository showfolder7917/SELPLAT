package com.sp.selplat.common.service;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.service.logging.OperationLog;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 为业务 Service 统一装配强类型 {@link BaseDao} 门面并提供默认 CRUD 主流程。
 * 主键发号和固定结果构建继续复用 {@link BaseExtendsServiceImpl} 的受保护公共能力。
 *
 * @param <D> 当前业务 Service 对应的 BaseDao 子接口，例如 {@code UniauthUserDao}
 */
public abstract class BaseServiceImpl<D extends BaseDao> extends BaseExtendsServiceImpl<D> implements BaseService {

    // 当前业务 DAO 由 Spring 按子类声明的泛型类型注入，避免每个 ServiceImpl 重复声明 DAO 字段和构造函数。
    @Autowired
    private D dao;

    /**
     * 返回当前业务 Service 绑定的强类型 DAO 门面。
     *
     * @return Spring 按泛型注入的 DAO 门面，例如 {@code UniauthUserDao} 代理
     */
    @Override
    protected D getDao() {
        // 统一返回 Spring 已按业务 Service 泛型注入的 DAO，子类只能通过 BaseDao 公开契约访问持久层。
        return dao;
    }

    /**
     * 返回当前业务资源指定 Grid 的默认字段列元数据。
     *
     * @param viewCode 前端 Grid 实例编码，例如 {@code user-management}
     * @param locale 当前语言，例如 {@code zh-CN}
     * @return 成功结果，例如
     *     {@code {"success":true,"data":{"source":"DEFAULT_METADATA","viewCode":"user-management",}
     *     {@code "columns":{"loginName":{"remarks":"登录账号","dataType":"VARCHAR"}}}}}
     * @throws CommonBusinessException viewCode 或 locale 为空时抛出，例如
     *     {@code CommonBusinessException("INVALID_VIEW_CODE", "表格实例编码不能为空。")}
     */
    @Override
    @OperationLog
    public CommonResult getGridColumn(String viewCode, String locale) {
        // 每个前端 Grid 必须有稳定 viewCode，空值统一转换为可识别的业务异常。
        if (!StringUtils.hasText(viewCode)) {
            // 使用稳定错误编码，让前端可以定位 Grid 实例参数。
            throw new CommonBusinessException("INVALID_VIEW_CODE", "表格实例编码不能为空。");
        }
        // 当前语言必须明确传递，避免未来配置接入时无法选择对应标题。
        if (!StringUtils.hasText(locale)) {
            // 语言错误进入公共业务异常响应，不向前端暴露 IllegalArgumentException。
            throw new CommonBusinessException("INVALID_LOCALE", "语言编码不能为空。");
        }
        // 使用有序结果保持来源、页面、语言和字段元数据的固定输出顺序。
        Map<String, Object> gridColumn = new LinkedHashMap<>();
        // 标记当前结果直接来自数据库元数据，未来 reference-data 命中时可切换为配置来源。
        gridColumn.put("source", "DEFAULT_METADATA");
        // 原样保留 Grid 实例编码，供前端区分同一资源的不同表格。
        gridColumn.put("viewCode", viewCode);
        // 原样保留语言，供未来 reference-data 选择对应字段标题。
        gridColumn.put("locale", locale);
        // 直接复用 BaseDao 公共只读字段元数据，全部固定表模块共享同一默认来源。
        gridColumn.put("columns", getDao().getDbColumnsMap());
        // 返回公共成功结构，业务模块不再重复组装 Grid 字段列。
        return buildSuccessResult(gridColumn, "Grid 字段列查询完成。");
    }

    /**
     * 使用前端分页参数查询当前 DAO 对应表。
     *
     * @param queryIn 来自 Controller 的分页参数和动态查询字段，例如
     *     {@code {"pageNo":1,"pageSize":10,"status":1,"loginNameLike":"admin"}}
     * @return 固定分页结果，例如
     *     {@code {"records":[{"id":1,"loginName":"admin"}],"totalCount":1,"pageNo":1,"pageSize":10}}
     */
    @OperationLog
    public CommonPageResult getStore(CommonPageParam queryIn) {
        // 单独取得前端动态查询字段，避免 DAO 调用同时承担参数解析职责。
        Map<String, Object> queryColumnValueMap = queryIn.getParamMap();
        // 单独取得前端页码，明确分页入口使用的当前页。
        Integer pageNo = queryIn.getPageNo();
        // 单独取得前端每页条数，明确分页入口使用的页面容量。
        Integer pageSize = queryIn.getPageSize();
        // 基础 Service 统一调用 BaseDao 默认分页入口，让业务模块直接复用公共排序口径。
        CommonPageResult pageResult = getDao().getPageList(queryColumnValueMap, pageNo, pageSize);
        // 返回 DAO 已构建的固定分页结构，不在业务 Service 再次包装。
        return pageResult;
    }

    /**
     * 使用前端主键参数查询当前 DAO 对应的单条记录。
     *
     * @param queryIn 来自 Controller 的单主键或复合主键参数，例如 {@code {"id":1}} 或
     *     {@code {"tenantId":10,"orderId":20}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":{"id":1,"loginName":"admin"},"msg":"详情查询完成。"}}
     * @throws CommonBusinessException 当主键不完整或数据库未命中记录时抛出，例如
     *     {@code CommonBusinessException("RECORD_NOT_FOUND", "未找到对应的数据。")}
     */
    @OperationLog
    public CommonResult getById(CommonParam queryIn) {
        // 基础 Service 把原始主键参数交给 BaseDao，由 DAO 元数据解析单主键或复合主键。
        Map<String, Object> record = getDao().getById(queryIn);
        // 未提供完整主键或数据库未命中记录时统一返回明确业务异常。
        if (record == null) {
            throw new CommonBusinessException("RECORD_NOT_FOUND", "未找到对应的数据。");
        }
        // 复用扩展基础层的固定结果构建能力生成详情查询成功结果。
        CommonResult result = buildSuccessResult(record, "详情查询完成。");
        // 返回已经完成统一字段填充的详情结果。
        return result;
    }

    /**
     * 使用前端批量主键参数查询当前 DAO 对应的多条记录。
     *
     * @param queryIn 来自 Controller 的多组单主键或复合主键参数，例如
     *     {@code {"items":[{"id":1},{"id":2}]}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":[{"id":1},{"id":2}],"msg":"批量详情查询完成。"}}
     */
    @OperationLog
    public CommonResult getByIds(CommonBatchParam queryIn) {
        // 基础 Service 把全部主键项一次交给 BaseDao，避免业务模块循环执行单条查询。
        List<Map<String, Object>> records = getDao().getByIds(queryIn);
        // 复用扩展基础层的固定结果构建能力承接 DAO 返回的记录列表。
        CommonResult result = buildSuccessResult(records, "批量详情查询完成。");
        // 返回已经完成统一字段填充的批量详情结果。
        return result;
    }

    /**
     * 为前端新增参数生成主键并写入当前 DAO 对应表。
     *
     * @param saveIn 来自 Controller 的新增字段，例如
     *     {@code {"loginName":"admin","displayName":"管理员"}}
     * @return 含生成主键的固定结果，例如
     *     {@code {"success":true,"data":{"id":100001,"loginName":"admin","displayName":"管理员"},"msg":"新增完成。"}}
     */
    @OperationLog
    public CommonResult insert(CommonParam saveIn) {
        // 复用扩展基础层发号能力，根据当前 DAO 元数据取得单主键或复合主键的全部生成值。
        Map<String, Long> generatedIdMap = getSequence();
        // 把生成主键按字段名写回同一个前端参数对象，供 DAO 直接落库。
        generatedIdMap.forEach(saveIn::putParam);
        // 基础 Service 直接调用 BaseDao 新增入口，不在应用 DAO 建立同义包装方法。
        getDao().insert(saveIn);
        // 单独取得新增后的最终字段映射，供统一返回结构直接复用。
        Map<String, Object> resultData = saveIn.getParamMap();
        // 复用扩展基础层的固定结果构建能力生成新增成功结果。
        CommonResult result = buildSuccessResult(resultData, "新增完成。");
        // 返回包含生成主键和实际新增字段的结果。
        return result;
    }

    /**
     * 为前端批量新增参数逐项生成主键并写入当前 DAO 对应表。
     *
     * @param saveIn 来自 Controller 的批量新增字段，例如
     *     {@code {"items":[{"loginName":"admin"},{"loginName":"auditor"}]}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":[{"id":100001},{"id":100002}],"affectedRows":2,"msg":"批量新增完成。"}}
     */
    @Transactional
    @OperationLog
    public CommonResult insertBatch(CommonBatchParam saveIn) {
        // 单独取得前端批量项，保证主键生成、DAO 调用和结果构建使用同一有序集合。
        List<CommonParam> saveItems = saveIn.getItems();
        // 逐项生成当前表需要的单主键或复合主键。
        for (CommonParam saveItem : saveItems) {
            // 复用扩展基础层发号能力生成本项全部主键值。
            Map<String, Long> generatedIdMap = getSequence();
            // 把本项全部生成主键按字段名写回同一个参数对象。
            generatedIdMap.forEach(saveItem::putParam);
        }
        // 公共 DAO 按每组最多一千条执行真实批量新增并返回累计影响行数。
        int affectedRows = getDao().insertBatch(saveIn);
        // 复用扩展基础层的固定结果构建能力返回原批量项和顶层影响行数。
        CommonResult result = buildSuccessResult(saveItems, affectedRows, "批量新增完成。");
        // 返回已经完成统一字段填充的批量新增结果。
        return result;
    }

    /**
     * 使用前端主键和更新字段修改当前 DAO 对应记录。
     *
     * @param saveIn 来自 Controller 的主键和更新字段，例如
     *     {@code {"id":1,"displayName":"管理员"}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":{"id":1,"displayName":"管理员"},"msg":"更新完成。"}}
     */
    @OperationLog
    public CommonResult update(CommonParam saveIn) {
        // 基础 Service 直接把原始参数交给 BaseDao，由 DAO 自动分离主键条件和更新字段。
        getDao().update(saveIn);
        // 单独取得更新后的同一字段映射，保持前端参数来源可追踪。
        Map<String, Object> resultData = saveIn.getParamMap();
        // 复用扩展基础层的固定结果构建能力生成更新成功结果。
        CommonResult result = buildSuccessResult(resultData, "更新完成。");
        // 返回已经完成统一字段填充的更新结果。
        return result;
    }

    /**
     * 使用前端批量主键和更新字段修改当前 DAO 对应记录。
     *
     * @param saveIn 来自 Controller 的批量主键和更新字段，例如
     *     {@code {"items":[{"id":1,"status":0},{"id":2,"status":0}]}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":[{"id":1,"status":0},{"id":2,"status":0}],}
     *     {@code "affectedRows":2,"msg":"批量更新完成。"}}
     */
    @Transactional
    @OperationLog
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        // 单独取得前端批量项，保证 DAO 调用与最终返回使用同一有序集合。
        List<CommonParam> saveItems = saveIn.getItems();
        // 公共 DAO 按一千条分组并按更新字段结构执行真实批量更新。
        int affectedRows = getDao().updateBatch(saveIn);
        // 复用扩展基础层的固定结果构建能力返回原批量项和顶层影响行数。
        CommonResult result = buildSuccessResult(saveItems, affectedRows, "批量更新完成。");
        // 返回已经完成统一字段填充的批量更新结果。
        return result;
    }

    /**
     * 使用前端主键和审计字段假删除当前 DAO 对应记录。
     *
     * @param deleteIn 来自 Controller 的主键和审计字段，例如
     *     {@code {"id":1,"lastOperateUserId":9}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":{"id":1,"lastOperateUserId":9,"status":0},"msg":"删除完成。"}}
     */
    @OperationLog
    public CommonResult delete(CommonParam deleteIn) {
        // 基础 Service 只开放 BaseDao 假删除入口，由 DAO 统一补状态和更新时间。
        getDao().softDelete(deleteIn);
        // 单独取得 DAO 已补删除字段的参数映射。
        Map<String, Object> resultData = deleteIn.getParamMap();
        // 复用扩展基础层的固定结果构建能力生成假删除成功结果。
        CommonResult result = buildSuccessResult(resultData, "删除完成。");
        // 返回已经完成统一字段填充的假删除结果。
        return result;
    }

    /**
     * 使用前端批量主键和审计字段假删除当前 DAO 对应记录。
     *
     * @param deleteIn 来自 Controller 的批量主键和审计字段，例如
     *     {@code {"items":[{"id":1},{"id":2}]}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":[{"id":1,"status":0},{"id":2,"status":0}],}
     *     {@code "affectedRows":2,"msg":"批量删除完成。"}}
     */
    @Transactional
    @OperationLog
    public CommonResult deleteBatch(CommonBatchParam deleteIn) {
        // 单独取得前端批量项，保证 DAO 补充的删除字段可以直接进入最终返回。
        List<CommonParam> deleteItems = deleteIn.getItems();
        // 公共 DAO 按一千条分组执行假删除并返回累计影响行数。
        int affectedRows = getDao().softDeleteBatch(deleteIn);
        // 复用扩展基础层的固定结果构建能力返回已补删除字段的批量项和顶层影响行数。
        CommonResult result = buildSuccessResult(deleteItems, affectedRows, "批量删除完成。");
        // 返回已经完成统一字段填充的批量假删除结果。
        return result;
    }
}
