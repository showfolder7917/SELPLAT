package com.sp.selplat.common.web.resolver;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 公共控制器 MVC 配置统一注册共通参数解析器。
 * 这里把 `CommonParam` 和 `CommonPageParam` 的解析逻辑挂到 Spring MVC，
 * 让后续业务控制器只声明一个参数对象即可拿到已经完成 body 与请求参数合并的最终入参。
 */
@Configuration
public class CommonControllerMvcConfig implements WebMvcConfigurer {

    // 分页参数解析器优先注册，保证分页控制器方法进入时先命中更具体的 CommonPageParam 类型。
    private final CommonPageParamArgumentResolver commonPageParamArgumentResolver;
    // 非分页参数解析器负责承接剩余 CommonParam 方法参数，保持普通 CRUD 接口的共通入参体验一致。
    private final CommonParamArgumentResolver commonParamArgumentResolver;

    /**
     * 构造公共控制器 MVC 配置。
     *
     * @param commonPageParamArgumentResolver 分页参数解析器
     * @param commonParamArgumentResolver 非分页参数解析器
     */
    @Autowired
    public CommonControllerMvcConfig(
        CommonPageParamArgumentResolver commonPageParamArgumentResolver,
        CommonParamArgumentResolver commonParamArgumentResolver
    ) {
        // 保存分页参数解析器，供 MVC 层统一注册到自定义参数解析链。
        this.commonPageParamArgumentResolver = commonPageParamArgumentResolver;
        // 保存非分页参数解析器，供 MVC 层统一注册到自定义参数解析链。
        this.commonParamArgumentResolver = commonParamArgumentResolver;
    }

    /**
     * 注册当前工程的自定义控制器参数解析器。
     *
     * @param argumentResolvers 参数解析器列表
     */
    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> argumentResolvers) {
        // 先注册更具体的分页解析器，确保 CommonPageParam 方法参数优先命中分页专用解析逻辑。
        argumentResolvers.add(commonPageParamArgumentResolver);
        // 再注册普通共通参数解析器，让 CommonParam 方法参数自动获得统一的 body + 请求参数合并能力。
        argumentResolvers.add(commonParamArgumentResolver);
    }
}
