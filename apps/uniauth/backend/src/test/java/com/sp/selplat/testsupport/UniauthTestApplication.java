package com.sp.selplat.testsupport;

import com.sp.selplat.uniauth.common.config.UniauthModuleConfiguration;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;

/** 为 Uniauth 模块测试提供无运行入口的 Spring Boot 测试上下文。 */
@SpringBootConfiguration
@EnableAutoConfiguration
@Import(UniauthModuleConfiguration.class)
public class UniauthTestApplication {
}
