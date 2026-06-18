package com.sp.selplat.uniauth.user.service;

import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserSaveIn;
import com.sp.selplat.uniauth.user.domain.out.UniauthUserItemOut;
import java.util.List;

// 用户服务只承接 ua_user 主表的增删改查业务动作。
public interface UniauthUserService {

    // store 兼容接口返回旧式页面联调所需的统一 JSON 字符串结构。
    String getStore(UniauthUserIn queryIn);

    // 列表查询返回符合筛选条件的账号集合。
    List<UniauthUserItemOut> listUsers(UniauthUserIn queryIn);

    // 详情查询返回指定账号的主表信息。
    UniauthUserItemOut getUserById(Long id);

    // 新增账号时负责校验字段、生成密码哈希并写入主表。
    UniauthUserItemOut createUser(UniauthUserSaveIn saveIn);

    // 更新账号时负责校验唯一性、按需更新密码并回查最新结果。
    UniauthUserItemOut updateUser(Long id, UniauthUserSaveIn saveIn);

    // 删除账号时按主键清理主表记录。
    void deleteUserById(Long id);
}
