package com.sp.selplat.mda.connectionprofile.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.service.logging.OperationLog;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.connectionprofile.dao.MdaConnectionProfileDao;
import com.sp.selplat.mda.connectionprofile.service.MdaConnectionProfileService;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 连接配置 Service 绑定唯一业务 DAO，并在本表边界内补齐查询、审计字段和事务规则。
 * 不落库的目标数据库运行能力由 capability 承担，禁止建立项目级 BaseService 特例。
 */
@Service
public class MdaConnectionProfileServiceImpl
        extends BaseServiceImpl<MdaConnectionProfileDao>
        implements MdaConnectionProfileService {

    /**
     * 查询有效连接配置并保持人工排序和主键排序稳定。
     *
     * @param queryIn 页面分页和筛选参数，例如 {@code {"pageNo":1,"pageSize":20}}
     * @return 有效记录分页结果，例如 {@code {"records":[{"id":100000,"status":1}],"totalCount":1}}
     */
    @Override
    @OperationLog
    public CommonPageResult getStore(CommonPageParam queryIn) {
        CommonPageParam requiredQuery = queryIn == null ? new CommonPageParam() : queryIn;
        requiredQuery.putParam("status", 1);
        return getDao().getPageList(
                requiredQuery.getParamMap(),
                "sortnum asc id asc",
                requiredQuery.getPageNo(),
                requiredQuery.getPageSize());
    }

    /**
     * 补齐连接配置创建和更新时间后执行公共新增。
     *
     * @param saveIn 页面新增字段，例如 {@code {"connectionName":"开发库","databaseType":"H2"}}
     * @return 公共新增结果，例如 {@code {"success":true,"data":{"id":100000},"msg":"新增完成。"}}
     */
    @Override
    @OperationLog
    public CommonResult insert(CommonParam saveIn) {
        applyInsertDefaults(saveIn);
        return super.insert(saveIn);
    }

    /**
     * 为批量连接配置补齐审计时间后执行公共批量新增。
     *
     * @param saveIn 页面批量新增字段，例如 {@code {"items":[{"connectionName":"开发库"}]}}
     * @return 公共批量结果，例如 {@code {"success":true,"affectedRows":1,"msg":"批量新增完成。"}}
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
     * 补齐连接配置更新时间后执行公共更新。
     *
     * @param saveIn 页面主键和更新字段，例如 {@code {"id":100000,"connectionName":"开发库二"}}
     * @return 公共更新结果，例如 {@code {"success":true,"data":{"id":100000},"msg":"更新完成。"}}
     */
    @Override
    @OperationLog
    public CommonResult update(CommonParam saveIn) {
        applyUpdateTime(saveIn);
        return super.update(saveIn);
    }

    /**
     * 为批量连接配置补齐更新时间后执行公共批量更新。
     *
     * @param saveIn 页面批量更新字段，例如 {@code {"items":[{"id":100000,"status":1}]}}
     * @return 公共批量结果，例如 {@code {"success":true,"affectedRows":1,"msg":"批量更新完成。"}}
     */
    @Override
    @Transactional("mdaTransactionManager")
    @OperationLog
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        if (saveIn != null) {
            saveIn.getItems().forEach(this::applyUpdateTime);
        }
        return super.updateBatch(saveIn);
    }

    /**
     * 为一条新增连接配置补齐创建和更新时间。
     *
     * @param saveIn 当前新增项，例如 {@code {"connectionName":"开发库"}}
     *     <p>执行完成后无返回值；缺失时补入 createdAt 和 updatedAt。
     */
    private void applyInsertDefaults(CommonParam saveIn) {
        if (saveIn == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        putIfAbsent(saveIn, "createdAt", now);
        putIfAbsent(saveIn, "updatedAt", now);
    }

    /**
     * 为一条更新连接配置刷新更新时间。
     *
     * @param saveIn 当前更新项，例如 {@code {"id":100000,"connectionName":"开发库二"}}
     *     <p>执行完成后无返回值；副作用是写入当前 updatedAt。
     */
    private void applyUpdateTime(CommonParam saveIn) {
        if (saveIn != null) {
            saveIn.putParam("updatedAt", LocalDateTime.now());
        }
    }

    /**
     * 仅在公共参数没有非空字段值时写入默认值。
     *
     * @param target 待补字段的公共参数，例如 {@code {"id":100000}}
     * @param key 数据库字段名，例如 {@code "createdAt"}
     * @param value 默认字段值，例如当前服务时间
     *     <p>执行完成后无返回值；已有非空字段保持不变。
     */
    private void putIfAbsent(CommonParam target, String key, Object value) {
        if (target.getParam(key) == null) {
            target.putParam(key, value);
        }
    }
}
