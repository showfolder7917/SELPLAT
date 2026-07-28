package com.sp.selplat.common.web.controller;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 模块说明注解用于给控制器声明统一的模块编码、模块名称和验证说明。
 * 公共控制器基类读取该注解后，可以自动回填验证接口里的 moduleCode 和说明文案。
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ModuleDescription {

    /**
     * 返回控制器所属模块的稳定编码。
     *
     * @return 模块编码，例如 {@code "uniauth-user"}
     */
    String code();

    /**
     * 返回控制器所属模块的人类可读名称。
     *
     * @return 模块名称，例如 {@code "统一认证用户"}
     */
    String name();

    /**
     * 返回当前控制器对外职责说明。
     *
     * @return 职责说明，例如 {@code "提供用户查询、新增、更新和假删除接口"}；未声明时返回空串
     */
    String description() default "";
}
