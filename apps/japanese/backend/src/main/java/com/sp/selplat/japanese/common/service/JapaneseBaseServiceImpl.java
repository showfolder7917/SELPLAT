package com.sp.selplat.japanese.common.service;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.time.LocalDateTime;

/**
 * 统一补租户、操作者、排序、状态和日期字段。
 *
 * @param <D> 当前表 DAO，例如 {@code JapaneseN2BlueBookQuestionDao}
 */
public abstract class JapaneseBaseServiceImpl<
        D extends BaseDao> extends BaseServiceImpl<D> {

    /**
     * 查询有效记录并保持稳定排序。
     *
     * @param queryIn 分页条件，例如 {@code {pageNo:1,pageSize:20}}
     * @return status=1 且按 sortnum、id 排序的结果
     */
    @Override
    public CommonPageResult getStore(
            CommonPageParam queryIn) {
        CommonPageParam value = queryIn == null
                ? new CommonPageParam() : queryIn;
        value.putParam("status", 1);
        return getDao().getPageList(
                value.getParamMap(),
                "sortnum asc id asc",
                value.getPageNo(),
                value.getPageSize());
    }

    /**
     * 补齐默认字段并生成主键。
     *
     * @param saveIn 新增字段，例如 {@code {name:"示例"}}
     * @return 含固定字段的新增结果
     */
    @Override
    public CommonResult insert(CommonParam saveIn) {
        LocalDateTime now = LocalDateTime.now();
        putIfAbsent(saveIn, "tenantId", 1L);
        putIfAbsent(saveIn, "lastOperateUserId", 1L);
        putIfAbsent(saveIn, "sortnum", 0);
        putIfAbsent(saveIn, "status", 1);
        putIfAbsent(saveIn, "createdAt", now);
        putIfAbsent(saveIn, "updatedAt", now);
        return super.insert(saveIn);
    }

    /**
     * 刷新更新时间并更新记录。
     *
     * @param saveIn 更新字段，例如 {@code {id:100001,name:"新名称"}}
     * @return 含更新时间的更新结果
     */
    @Override
    public CommonResult update(CommonParam saveIn) {
        saveIn.putParam("updatedAt", LocalDateTime.now());
        return super.update(saveIn);
    }

    /**
     * 只补空字段。
     *
     * @param target 当前新增参数
     * @param key 默认字段名，例如 {@code tenantId}
     * @param value 默认值，例如 {@code 1L}
     *     <p>执行后无返回值；已有值保持不变。
     */
    private void putIfAbsent(
            CommonParam target,
            String key,
            Object value) {
        if (target.getParam(key) == null) {
            target.putParam(key, value);
        }
    }
}
