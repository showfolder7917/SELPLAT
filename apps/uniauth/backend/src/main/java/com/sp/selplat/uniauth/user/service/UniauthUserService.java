package com.sp.selplat.uniauth.user.service;

import com.sp.selplat.common.service.BaseCrudService;

/**
 * 用户服务继承公共 CRUD 契约，前端字段从控制器原样进入公共服务链。
 * 用户模块实现只补充密码摘要等模块特有处理，不重复声明公共方法。
 */
public interface UniauthUserService extends BaseCrudService {
}
