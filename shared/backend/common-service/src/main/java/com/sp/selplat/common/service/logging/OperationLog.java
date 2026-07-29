package com.sp.selplat.common.service.logging;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记需要统一记录开始、结果、耗时和异常的 Service 业务操作。
 * 该标记只用于 Service 方法；Controller、DAO 不使用它，避免同一操作重复记录。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface OperationLog {
}
