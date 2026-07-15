package com.sp.selplat.common.controller;

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

    // code 表示控制器所属模块的稳定编码，供验证接口或后续日志、文档能力统一引用。
    String code();

    // name 表示控制器所属模块的人类可读名称，供后续公共提示文案或文档展示使用。
    String name();

    // description 表示当前控制器对外职责说明，供验证接口直接回填给联调方。
    String description() default "";
}
