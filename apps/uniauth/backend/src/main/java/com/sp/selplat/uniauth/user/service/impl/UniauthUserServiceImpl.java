package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.support.CommonHashSupport;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 用户服务实现把前端 CommonParam 直接交给公共 DAO，当前只保留主键生成和密码摘要这两个必要落库转换。
@Service
public class UniauthUserServiceImpl extends BaseServiceImpl<UniauthUserDao> implements UniauthUserService {

    // 前端传入 pageNo、pageSize 和动态查询字段；服务层直接透传分页信息与查询映射，不再重复包装参数对象。
    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        // 直接调用 BaseDao 三参数分页入口，统一复用基础实现维护的 sortnum desc 默认排序。
        return getDao().getPageList(queryIn.getParamMap(), queryIn.getPageNo(), queryIn.getPageSize());
    }

    // 前端直接传入当前表的单主键或复合主键字段；服务层把原始 CommonParam 交给公共 DAO。
    @Override
    public CommonResult getById(CommonParam queryIn) {
        // 直接调用 BaseDao 的 CommonParam 主键查询，由基础实现根据当前表元数据识别全部主键字段。
        Map<String, Object> userRecord = getDao().getById(queryIn);
        // 未提供完整主键或数据库未命中记录时统一返回明确业务异常。
        if (userRecord == null) {
            throw new IllegalArgumentException("未找到对应的用户。");
        }
        // 统一按共通返回对象回传详情数据，保持模块对外单条查询出口一致。
        return buildSuccessResult(userRecord, "用户详情查询完成。");
    }

    // 前端 items 中每项直接承接当前表主键字段；公共 DAO 按一千条分组执行批量查询。
    @Override
    public CommonResult getByIds(CommonBatchParam queryIn) {
        // 批量查询结果由 BaseDao 公共入口一次返回，Service 不重新组装主键或循环查询。
        return buildSuccessResult(getDao().getByIds(queryIn), "用户批量详情查询完成。");
    }

    // 前端直接传入数据库业务字段；服务层只补生成主键并把 password 转换成 passwordHash。
    @Override
    public CommonResult insert(CommonParam saveIn) {
        // DAO 根据表名和主键元数据生成号段定义，服务层不再硬编码任何模块专用号段常量。
        Map<String, Long> generatedIdMap = getSequence();
        // 把每个生成主键直接写回前端 CommonParam，兼容单主键和复合主键且不再新建列值映射。
        generatedIdMap.forEach(saveIn::putParam);
        // 密码字段只执行落库必需的摘要转换，不在当前 Service 分散实现其他验证规则。
        replacePasswordWithHash(saveIn);
        // 原始 CommonParam 直接交给 BaseDao insert，由 DAO 读取动态字段完成新增。
        getDao().insert(saveIn);
        // DAO 完成同步落库后从返回参数中移除密码摘要，避免敏感信息回传前端。
        saveIn.getParamMap().remove("passwordHash");
        // 返回同一个参数对象中的最终字段，让前端看到生成主键和实际提交内容。
        return buildSuccessResult(saveIn.getParamMap(), "用户新增完成。");
    }

    // 前端 items 中每项直接传入新增字段；整个多分组新增必须在同一事务内成功或回滚。
    @Override
    @Transactional
    public CommonResult insertBatch(CommonBatchParam saveIn) {
        // 逐项补充独立单主键或复合主键，并完成每条密码摘要转换。
        for (CommonParam saveItem : saveIn.getItems()) {
            // 当前 DAO 号段定义为本项生成全部主键字段值。
            Map<String, Long> generatedIdMap = getSequence();
            // 每个生成主键按字段名直接写回当前批量项。
            generatedIdMap.forEach(saveItem::putParam);
            // 当前项密码只在存在时转换成数据库摘要字段。
            replacePasswordWithHash(saveItem);
        }
        // 公共 DAO 按每组最多一千条执行真实 JDBC 批量新增并返回累计影响行数。
        int affectedRows = getDao().insertBatch(saveIn);
        // 数据库成功后逐项移除密码摘要，避免敏感值进入服务返回。
        for (CommonParam saveItem : saveIn.getItems()) {
            // 当前项只保留可回传的生成主键和业务字段。
            saveItem.getParamMap().remove("passwordHash");
        }
        // data 直接返回最终批量项，DAO 影响行数写入 CommonResult 顶层固定字段。
        return buildSuccessResult(saveIn.getItems(), affectedRows, "用户批量新增完成。");
    }

    // 前端直接传入主键和待修改字段；Service 不再查询旧记录、验证字段或重新组装更新 Map。
    @Override
    public CommonResult update(CommonParam saveIn) {
        // 前端传入 password 时只转换成数据库使用的 passwordHash，其他字段保持原样。
        replacePasswordWithHash(saveIn);
        // 原始 CommonParam 直接交给 BaseDao update，由 DAO 自动提取主键并更新其余字段。
        getDao().update(saveIn);
        // DAO 完成同步落库后从返回参数中移除密码摘要，避免敏感信息回传前端。
        saveIn.getParamMap().remove("passwordHash");
        // 返回前端直接提交的同一字段映射。
        return buildSuccessResult(saveIn.getParamMap(), "用户更新完成。");
    }

    // 前端 items 中每项直接传入主键和更新字段；整个多分组更新由事务保证原子性。
    @Override
    @Transactional
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        // 逐项执行落库必需的密码摘要转换，其他动态字段保持原样。
        for (CommonParam saveItem : saveIn.getItems()) {
            // 当前项存在 password 时转换为 passwordHash。
            replacePasswordWithHash(saveItem);
        }
        // 公共 DAO 按一千条分组，并在组内按更新字段结构执行真实 JDBC batch。
        int affectedRows = getDao().updateBatch(saveIn);
        // 批量更新成功后移除所有密码摘要，避免服务响应泄露敏感字段。
        for (CommonParam saveItem : saveIn.getItems()) {
            // 当前项返回结构只保留前端可见字段。
            saveItem.getParamMap().remove("passwordHash");
        }
        // data 直接返回当前批量项，累计更新行数使用已确认的 CommonResult 顶层字段。
        return buildSuccessResult(saveIn.getItems(), affectedRows, "用户批量更新完成。");
    }

    // 前端直接传入主键和审计字段；Service 不再查询旧记录、读取主键或重新封装删除结果。
    @Override
    public CommonResult delete(CommonParam deleteIn) {
        // 原始 CommonParam 直接交给 BaseDao softDelete，由 DAO 自动提取主键并补状态与更新时间。
        getDao().softDelete(deleteIn);
        // DAO 已把 status 和 updatedAt 写回同一参数对象，直接作为删除结果返回。
        return buildSuccessResult(deleteIn.getParamMap(), "用户删除完成。");
    }

    // 前端 items 中每项直接传入主键和审计字段；整个多分组假删除由事务保证原子性。
    @Override
    @Transactional
    public CommonResult deleteBatch(CommonBatchParam deleteIn) {
        // 公共 DAO 统一补 status 与 updatedAt，并按每组最多一千条执行真实 JDBC 批量更新。
        int affectedRows = getDao().softDeleteBatch(deleteIn);
        // data 直接返回已补公共删除字段的批量项，累计假删除行数保持在 CommonResult 顶层。
        return buildSuccessResult(deleteIn.getItems(), affectedRows, "用户批量删除完成。");
    }

    // 前端 password 仅在存在时转换为 passwordHash，并从通用参数中移除不可直接落库的明文字段。
    private void replacePasswordWithHash(CommonParam saveIn) {
        // 直接读取同一个 CommonParam 中的明文密码，不创建新的保存映射。
        Object password = saveIn.getParam("password");
        // 未传密码时保持全部前端字段原样，更新流程不会覆盖已有密码摘要。
        if (password == null) {
            return;
        }
        // 把密码摘要写回同一个参数对象，供 BaseDao 直接读取数据库列名。
        saveIn.putParam("passwordHash", CommonHashSupport.sha256(String.valueOf(password)));
        // 删除没有对应数据库列的明文 password，避免模板 SQL 尝试写入错误字段。
        saveIn.getParamMap().remove("password");
    }

}
