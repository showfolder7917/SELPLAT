package com.sp.selplat.uniauth.user.controller;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

/**
 * 校验用户控制器对外路由始终与 Java 方法名保持一致，避免调用方继续依赖已废弃的简写路径。
 */
class UniauthUserControllerRouteTest {

    @Test
    void requestMappingValuesUseMethodNamesWithHtmSuffix() throws NoSuchMethodException {
        // 列表接口允许查询页在浏览器或旧客户端通过 GET、POST 两种方式调用，路径必须直接对应 getStore 方法名。
        assertRoute("getStore", CommonPageParam.class, "getStore.htm", RequestMethod.GET, RequestMethod.POST);
        // 详情接口同样保留 GET、POST 兼容性，路径必须直接对应 getById 方法名。
        assertRoute("getById", CommonParam.class, "getById.htm", RequestMethod.GET, RequestMethod.POST);
        // 写操作只接受 POST，路径仍必须直接对应其业务方法名。
        assertRoute("create", CommonParam.class, "create.htm", RequestMethod.POST);
        // 更新操作只接受 POST，路径仍必须直接对应其业务方法名。
        assertRoute("update", CommonParam.class, "update.htm", RequestMethod.POST);
        // 删除操作只接受 POST，路径仍必须直接对应其业务方法名。
        assertRoute("delete", CommonParam.class, "delete.htm", RequestMethod.POST);
    }

    private void assertRoute(
        String methodName,
        Class<?> parameterType,
        String expectedPath,
        RequestMethod... expectedMethods
    ) throws NoSuchMethodException {
        // 根据方法名和唯一入参定位控制器公开入口，确保校验直接绑定真实接口而不是手写字符串清单。
        Method controllerMethod = UniauthUserController.class.getMethod(methodName, parameterType);
        // 读取入口注解中对外发布的路径和 HTTP 方法约束，作为客户端实际可访问的路由契约。
        RequestMapping requestMapping = controllerMethod.getAnnotation(RequestMapping.class);
        // 断言映射只有一个主路径且等于方法名加 .htm，防止后续修改重新引入 get、store 等简写别名。
        assertEquals(expectedPath, requestMapping.value()[0]);
        // 断言 HTTP 方法范围保持当前业务约定，避免统一路径时意外扩大或收窄调用方式。
        assertArrayEquals(expectedMethods, requestMapping.method());
    }
}
