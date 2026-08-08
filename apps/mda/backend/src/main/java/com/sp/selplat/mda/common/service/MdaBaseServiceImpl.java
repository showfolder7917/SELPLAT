package com.sp.selplat.mda.common.service;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.service.logging.OperationLog;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.time.LocalDateTime;
import org.springframework.transaction.annotation.Transactional;

/**
 * 为 MDA 固定控制表统一补充工程级查询、审计字段和具名事务边界。
 * 具体业务 Service 只绑定 DAO；主键生成、CRUD 和结果构建继续调用公共父类实现。
 *
 * @param <D> 当前 MDA 固定控制表对应的 DAO，例如 {@code MdaConnectionProfileDao}
 */
public abstract class MdaBaseServiceImpl<D extends BaseDao> extends BaseServiceImpl<D> {

    /**
     * 查询当前 MDA 固定表的有效记录并保持页面稳定顺序。
     *
     * @param queryIn 页面分页和筛选参数，例如 {@code {"pageNo":1,"pageSize":20}}
     * @return 有效记录分页结果，例如 {@code {"records":[{"id":100000,"status":1}],"totalCount":1}}
     */
    @Override
    @OperationLog
    public CommonPageResult getStore(CommonPageParam queryIn) {
        CommonPageParam requiredQuery = queryIn == null ? new CommonPageParam() : queryIn;
        // MDA 控制表查询统一排除逻辑删除记录，具体 Service 不再重复补 status 条件。
        requiredQuery.putParam("status", 1);
        // MDA 页面统一按人工排序值升序，再按主键稳定排序。
        return getDao().getPageList(
                requiredQuery.getParamMap(),
                "sortnum asc id asc",
                requiredQuery.getPageNo(),
                requiredQuery.getPageSize());
    }

    /**
     * 补齐 MDA 工程公共新增字段后调用父类生成主键并写入当前表。
     *
     * @param saveIn 页面新增字段，例如 {@code {"connectionName":"开发库","databaseType":"H2"}}
     * @return 父类固定新增结果，例如 {@code {"success":true,"data":{"id":100000},"msg":"新增完成。"}}
     */
    @Override
    @OperationLog
    public CommonResult insert(CommonParam saveIn) {
        applyInsertDefaults(saveIn);
        return super.insert(saveIn);
    }

    /**
     * 逐项补齐 MDA 工程公共新增字段后调用父类真实批量新增。
     *
     * @param saveIn 页面批量新增字段，例如 {@code {"items":[{"connectionName":"开发库"}]}}
     * @return 父类固定批量结果，例如 {@code {"success":true,"affectedRows":1,"msg":"批量新增完成。"}}
     */
    @Override
    @Transactional("mdaTransactionManager")
    @OperationLog
    public CommonResult insertBatch(CommonBatchParam saveIn) {
        if (saveIn != null) {
            saveIn.getItems().forEach(this::applyInsertDefaults);
        }
        return super.insertBatch(saveIn);
    }

    /**
     * 补齐 MDA 工程公共更新审计字段后调用父类更新当前记录。
     *
     * @param saveIn 页面主键和更新字段，例如 {@code {"id":100000,"connectionName":"开发库二"}}
     * @return 父类固定更新结果，例如 {@code {"success":true,"data":{"id":100000},"msg":"更新完成。"}}
     */
    @Override
    @OperationLog
    public CommonResult update(CommonParam saveIn) {
        applyUpdateAudit(saveIn);
        return super.update(saveIn);
    }

    /**
     * 逐项补齐 MDA 工程公共更新审计字段后调用父类真实批量更新。
     *
     * @param saveIn 页面批量更新字段，例如 {@code {"items":[{"id":100000,"status":1}]}}
     * @return 父类固定批量结果，例如 {@code {"success":true,"affectedRows":1,"msg":"批量更新完成。"}}
     */
    @Override
    @Transactional("mdaTransactionManager")
    @OperationLog
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        if (saveIn != null) {
            saveIn.getItems().forEach(this::applyUpdateAudit);
        }
        return super.updateBatch(saveIn);
    }

    /**
     * 补齐 MDA 工程删除审计字段后调用父类执行假删除。
     *
     * @param deleteIn 页面主键字段，例如 {@code {"id":100000}}
     * @return 父类固定删除结果，例如 {@code {"success":true,"data":{"id":100000,"status":0},"msg":"删除完成。"}}
     */
    @Override
    @OperationLog
    public CommonResult delete(CommonParam deleteIn) {
        applyOperatorDefault(deleteIn);
        return super.delete(deleteIn);
    }

    /**
     * 逐项补齐 MDA 工程删除审计字段后调用父类真实批量假删除。
     *
     * @param deleteIn 页面批量主键字段，例如 {@code {"items":[{"id":100000}]}}
     * @return 父类固定批量结果，例如 {@code {"success":true,"affectedRows":1,"msg":"批量删除完成。"}}
     */
    @Override
    @Transactional("mdaTransactionManager")
    @OperationLog
    public CommonResult deleteBatch(CommonBatchParam deleteIn) {
        if (deleteIn != null) {
            deleteIn.getItems().forEach(this::applyOperatorDefault);
        }
        return super.deleteBatch(deleteIn);
    }

    /**
     * 为 MDA 新增参数补齐统一租户、操作人和创建更新时间。
     *
     * @param saveIn 当前新增项，例如 {@code {"connectionName":"开发库"}}
     *     <p>执行完成后无返回值；副作用是缺失时补入 tenantId、lastOperateUserId、createdAt 和 updatedAt。
     */
    private void applyInsertDefaults(CommonParam saveIn) {
        if (saveIn == null) {
            return;
        }
        applyOperatorDefault(saveIn);
        putIfAbsent(saveIn, "tenantId", 1L);
        LocalDateTime now = LocalDateTime.now();
        putIfAbsent(saveIn, "createdAt", now);
        putIfAbsent(saveIn, "updatedAt", now);
    }

    /**
     * 为 MDA 更新参数补齐统一操作人和更新时间。
     *
     * @param saveIn 当前更新项，例如 {@code {"id":100000,"connectionName":"开发库二"}}
     *     <p>执行完成后无返回值；副作用是缺失时补入 lastOperateUserId，并刷新 updatedAt。
     */
    private void applyUpdateAudit(CommonParam saveIn) {
        if (saveIn == null) {
            return;
        }
        applyOperatorDefault(saveIn);
        saveIn.putParam("updatedAt", LocalDateTime.now());
    }

    /**
     * 为 MDA 写入参数补齐统一操作人。
     *
     * @param saveIn 当前写入项，例如 {@code {"id":100000}}
     *     <p>执行完成后无返回值；副作用是 lastOperateUserId 缺失时补入 {@code 1L}。
     */
    private void applyOperatorDefault(CommonParam saveIn) {
        if (saveIn != null) {
            putIfAbsent(saveIn, "lastOperateUserId", 1L);
        }
    }

    /**
     * 仅在公共参数没有非空字段值时写入默认值。
     *
     * @param target 待补字段的公共参数，例如 {@code {"id":100000}}
     * @param key 数据库字段名，例如 {@code "tenantId"}
     * @param value 默认字段值，例如 {@code 1L}
     *     <p>执行完成后无返回值；已有非空字段保持不变。
     */
    private void putIfAbsent(CommonParam target, String key, Object value) {
        if (target.getParam(key) == null) {
            target.putParam(key, value);
        }
    }
}
