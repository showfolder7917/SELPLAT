package com.sp.selplat.uniauth.user.service;

import com.sp.selplat.common.service.BaseCrudService;
import com.sp.selplat.common.util.CommonResult;

/**
 * 用户服务继承公共 CRUD 契约，前端字段从控制器原样进入公共服务链。
 * 用户模块实现只补充密码摘要等模块特有处理，不重复声明公共方法。
 */
public interface UniauthUserService extends BaseCrudService {

    /**
     * 返回当前用户资源的前端表格定义。
     *
     * @param viewCode 前端表格实例编码，例如 {@code user-management}
     * @param locale 当前语言，例如 {@code zh-CN}
     * @return 成功结果，例如
     *     {@code {"success":true,"data":{"source":"DEFAULT_METADATA","resourceCode":"UniauthUser"}}}
     */
    CommonResult getTableDefinition(String viewCode, String locale);
}
