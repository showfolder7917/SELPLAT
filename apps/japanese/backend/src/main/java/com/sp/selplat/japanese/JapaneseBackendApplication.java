package com.sp.selplat.japanese;

import com.sp.selplat.referencedata.backend.controller.ReferenceDataController;
import com.sp.selplat.referencedata.backend.provider.ReferenceDataProviderRegistry;
import com.sp.selplat.referencedata.backend.service.DefaultReferenceDataApiService;
import com.sp.selplat.referencedata.backend.service.DefaultReferenceDataQueryService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;

/** 独立启动 Japanese 后端并装配本工程私有数据源。 */
@SpringBootApplication(scanBasePackages = {
    "com.sp.selplat.japanese",
    "com.sp.selplat.common.service",
    "com.sp.selplat.common.web"
})
@Import({
    ReferenceDataController.class,
    ReferenceDataProviderRegistry.class,
    DefaultReferenceDataApiService.class,
    DefaultReferenceDataQueryService.class
})
public class JapaneseBackendApplication {

    /**
     * 启动本工程独立 HTTP 进程。
     *
     * @param args 启动参数，例如 {@code ["--server.port=8090"]}
     *     <p>执行后无返回值；副作用是创建 Spring 容器和 H2 连接池。
     */
    public static void main(String[] args) {
        SpringApplication.run(
                JapaneseBackendApplication.class,
                args);
    }
}
