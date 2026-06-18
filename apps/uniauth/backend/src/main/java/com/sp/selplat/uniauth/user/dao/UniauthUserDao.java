package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserSaveIn;
import com.sp.selplat.uniauth.user.domain.out.UniauthUserItemOut;
import java.util.List;
import java.util.Map;

// 用户 DAO 接口对业务层暴露统一持久化能力，既承接 XML 自定义 SQL，也承接 BaseDao 模板能力。
public interface UniauthUserDao {

    // store 兼容接口按查询对象返回旧式列表结构，内部允许实现类走 BaseDao 模板查询。
    List<Map<String, Object>> getStoreList(UniauthUserIn queryIn);

    // 正式列表接口按筛选条件返回账号主表结果，内部允许实现类走 MyBatis XML 自定义查询。
    List<UniauthUserItemOut> selectUserList(UniauthUserIn query);

    // 详情接口按主键返回单条账号主表数据，供详情、更新回显和删除前校验复用。
    UniauthUserItemOut selectUserById(Long id);

    // 登录名查询按唯一账号标识返回主表数据，供新增和更新唯一性校验复用。
    UniauthUserItemOut selectUserByLoginName(String loginName);

    // 新增接口负责把保存入参和密码哈希写入主表，并由底层实现处理主键回填。
    int insertUser(UniauthUserSaveIn in, String passwordHash);

    // 更新接口负责按主键覆盖主表字段，并在需要时同时更新密码哈希。
    int updateUser(UniauthUserSaveIn in, String passwordHash);

    // 删除接口按主键移除目标账号主表记录。
    int deleteUserById(Long id);
}
