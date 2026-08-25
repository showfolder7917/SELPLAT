package com.sp.selplat.testsupport;

import com.sp.selplat.mda.common.config.MdaModuleConfiguration;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.context.annotation.Import;

/** 为 MDA 模块测试提供无运行入口且不创建默认数据源的 Spring Boot 测试上下文。 */
@SpringBootConfiguration
@EnableAutoConfiguration(exclude = DataSourceAutoConfiguration.class)
@Import(MdaModuleConfiguration.class)
public class MdaTestApplication {
}
