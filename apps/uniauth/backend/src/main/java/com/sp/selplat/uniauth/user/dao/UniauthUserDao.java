package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserSaveIn;
import com.sp.selplat.uniauth.user.domain.out.UniauthUserItemOut;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// 用户 DAO 继续承接 ua_user 主表的增删改查，同时继承公共模板为后续统一方法口径预留入口。
@Mapper
public interface UniauthUserDao extends BaseDao<UniauthUserItemOut, UniauthUserIn, UniauthUserSaveIn, Long> {

    // 列表查询按可选筛选条件返回账号主表数据。
    List<UniauthUserItemOut> selectUserList(@Param("query") UniauthUserIn query);

    // 按主键查询单个账号详情，供详情、更新回显和删除前校验复用。
    UniauthUserItemOut selectUserById(@Param("id") Long id);

    // 按登录名查询账号主数据，供新增唯一性校验和更新冲突校验复用。
    UniauthUserItemOut selectUserByLoginName(@Param("loginName") String loginName);

    // 新增账号主表记录，并回填数据库生成的用户主键。
    int insertUser(@Param("in") UniauthUserSaveIn in, @Param("passwordHash") String passwordHash);

    // 更新账号主表记录，并在需要时覆盖密码哈希。
    int updateUser(@Param("in") UniauthUserSaveIn in, @Param("passwordHash") String passwordHash);

    // 按主键删除账号主表记录。
    int deleteUserById(@Param("id") Long id);
}
