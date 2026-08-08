package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.support.CommonHashSupport;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.service.logging.OperationLog;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 用户服务通过 {@link BaseServiceImpl} 复用公共查询和持久化流程。
 * 本实现只在新增与更新同名方法中处理密码摘要，随后调用父类完成固定公共链路。
 */
@Service
public class UniauthUserServiceImpl extends BaseServiceImpl<UniauthUserDao> implements UniauthUserService {

    // 前端直接传入数据库业务字段；用户子类先转换密码，再调用父类统一完成主键生成、新增和结果构建。
    @Override
    @OperationLog
    public CommonResult insert(CommonParam saveIn) {
        // 用户专属入口在公共新增前把 password 转换成数据库列 passwordHash。
        replacePasswordWithHash(saveIn);
        // 扩展父类统一生成主键、调用 BaseDao.insert 并构建固定 CommonResult。
        CommonResult result = super.insert(saveIn);
        // 父类返回数据引用同一个参数映射，移除摘要后响应中也不会包含敏感字段。
        saveIn.getParamMap().remove("passwordHash");
        // 返回父类已经完成统一字段填充且已清理敏感字段的新增结果。
        return result;
    }

    // 前端 items 中每项直接传入新增字段；用户子类完成密码转换后调用父类统一批量新增。
    @Override
    @Transactional
    @OperationLog
    public CommonResult insertBatch(CommonBatchParam saveIn) {
        // 单独取得前端批量项，让密码转换和响应清理使用同一有序集合。
        List<CommonParam> saveItems = saveIn.getItems();
        // 逐项完成用户专属密码摘要转换。
        for (CommonParam saveItem : saveItems) {
            // 当前项密码只在存在时转换成数据库摘要字段。
            replacePasswordWithHash(saveItem);
        }
        // 扩展父类统一逐项生成主键、调用 BaseDao.insertBatch 并构建固定 CommonResult。
        CommonResult result = super.insertBatch(saveIn);
        // 数据库成功后逐项移除密码摘要，父类结果引用同一批量项集合。
        for (CommonParam saveItem : saveItems) {
            // 当前项只保留可回传的生成主键和业务字段。
            saveItem.getParamMap().remove("passwordHash");
        }
        // 返回父类已经完成统一字段填充且已清理敏感字段的批量新增结果。
        return result;
    }

    // 前端直接传入主键和待修改字段；用户子类先转换密码，再调用父类统一更新。
    @Override
    @OperationLog
    public CommonResult update(CommonParam saveIn) {
        // 用户专属入口在公共更新前把 password 转换成数据库列 passwordHash。
        replacePasswordWithHash(saveIn);
        // 扩展父类统一调用 BaseDao.update 并构建固定 CommonResult。
        CommonResult result = super.update(saveIn);
        // 父类返回数据引用同一个参数映射，移除摘要后响应中也不会包含敏感字段。
        saveIn.getParamMap().remove("passwordHash");
        // 返回父类已经完成统一字段填充且已清理敏感字段的更新结果。
        return result;
    }

    // 前端 items 中每项直接传入主键和更新字段；用户子类完成密码转换后调用父类统一批量更新。
    @Override
    @Transactional
    @OperationLog
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        // 单独取得前端批量项，让密码转换和响应清理使用同一有序集合。
        List<CommonParam> saveItems = saveIn.getItems();
        // 逐项执行用户专属密码摘要转换，其他动态字段保持原样。
        for (CommonParam saveItem : saveItems) {
            // 当前项存在 password 时转换为 passwordHash。
            replacePasswordWithHash(saveItem);
        }
        // 扩展父类统一调用 BaseDao.updateBatch 并构建固定 CommonResult。
        CommonResult result = super.updateBatch(saveIn);
        // 批量更新成功后移除所有密码摘要，父类结果引用同一批量项集合。
        for (CommonParam saveItem : saveItems) {
            // 当前项返回结构只保留前端可见字段。
            saveItem.getParamMap().remove("passwordHash");
        }
        // 返回父类已经完成统一字段填充且已清理敏感字段的批量更新结果。
        return result;
    }

    /**
     * 前端 password 仅在存在时转换为 passwordHash，并从通用参数中移除不可直接落库的明文字段。
     *
     * @param saveIn 前端新增或更新参数，例如
     *     {@code {"paramMap":{"loginName":"admin","password":"secret"}}}；执行后只保留 passwordHash
     */
    private void replacePasswordWithHash(CommonParam saveIn) {
        // 直接读取同一个 CommonParam 中的明文密码，不创建新的保存映射。
        Object password = saveIn.getParam("password");
        // 未传密码时保持全部前端字段原样，更新流程不会覆盖已有密码摘要。
        if (password == null) {
            return;
        }
        // 先把前端密码值转换成明确字符串，避免摘要调用行同时承担类型转换职责。
        String passwordText = String.valueOf(password);
        // 使用公共哈希能力单独生成数据库需要的密码摘要。
        String passwordHash = CommonHashSupport.sha256(passwordText);
        // 把密码摘要写回同一个参数对象，供 BaseDao 直接读取数据库列名。
        saveIn.putParam("passwordHash", passwordHash);
        // 删除没有对应数据库列的明文 password，避免模板 SQL 尝试写入错误字段。
        saveIn.getParamMap().remove("password");
    }

}
