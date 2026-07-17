package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import java.util.Map;

// 用户 DAO 接口在保留 store 兼容查询入口的同时，正式接入 common-db 的公共 DAO 能力。
public interface UniauthUserDao extends BaseDao {

    // store 兼容接口按共通分页参数返回统一分页结果，内部直接走 BaseDao 公共分页能力。
    CommonPageResult getStorePage(CommonPageParam queryIn);

    // 根据主键读取单个有效用户详情，供服务层统一包装成共通返回对象。
    Map<String, Object> getUserById(Long id);

    // 读取指定登录账号对应的有效用户，供新增或更新时做唯一性校验。
    Map<String, Object> getUserByLoginName(String loginName);

    // 新增用户时按列值映射落库，供服务层在生成主键和密码摘要后直接调用。
    int insertUser(Map<String, Object> columnValueMap);

    // 更新用户时按主键和值映射回写数据，供服务层统一维护更新时间和最近操作用户。
    int updateUser(Long id, Map<String, Object> columnValueMap);

    // 删除用户时统一执行假删除，把 status 改成 0 并维护最近操作用户。
    int softDeleteUser(Long id, Long lastOperateUserId);
}
