package com.sp.selplat.code.rule;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * 验证主规则文件与同名资产目录保持并列，并确保 Java 注释规则的模板和实际返回示例可以从规则资源加载。
 */
class RuleResourceStructureTest {

    /**
     * 验证规则索引只指向范围根下的主规则文件。
     *
     * 执行结果示例：索引包含
     * `SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES =
     * selplat/通用规则/RUL_Java业务注释与返回示例规则.md`，
     * 且不包含 `RUL_Java业务注释与返回示例规则/RUL_Java业务注释与返回示例规则.md`。
     *
     * @throws IOException 规则索引读取失败
     */
    @Test
    void shouldReferenceSiblingMainRuleFilesFromIndex() throws IOException {
        // 读取打包后的唯一规则索引 → 完整 UTF-8 DSL 正文。
        String ruleIndex = readResource("RULE_INDEX.md");
        // Java 注释主规则必须直接位于 SELPLAT 通用规则根。
        assertTrue(ruleIndex.contains(
            "SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES = "
                + "selplat/通用规则/RUL_Java业务注释与返回示例规则.md"
        ));
        // 生命周期主规则不得继续使用“同名目录内再放同名主规则”的错误嵌套路径。
        assertFalse(ruleIndex.contains(
            "RUL_规则生命周期治理规则/RUL_规则生命周期治理规则.md"
        ));
        // 基础 DAO 主规则也必须完成并列结构迁移。
        assertFalse(ruleIndex.contains(
            "RUL_基础DAO复用与通用参数透传规则/RUL_基础DAO复用与通用参数透传规则.md"
        ));
    }

    /**
     * 验证 Java 注释规则、模板和 BaseDaoSupportImpl 真实示例同时存在。
     *
     * 执行结果示例：主规则包含
     * `{"id":"UniauthUserId"}`，模板包含 `CommonPageResult`，
     * 实际样例包含 `{"id":1,"displayName":"新名称"}`。
     *
     * @throws IOException 规则、模板或样例读取失败
     */
    @Test
    void shouldLoadJavaCommentRuleTemplateAndActualExamples() throws IOException {
        // 读取 Java 注释唯一主规则 → 包含返回示例强制约束的 DSL 正文。
        String mainRule = readResource(
            "selplat/通用规则/RUL_Java业务注释与返回示例规则.md"
        );
        // 读取同名资产目录中的生成模板 → JavaDoc 与逐行业务注释骨架。
        String template = readResource(
            "selplat/通用规则/RUL_Java业务注释与返回示例规则/template/Java业务注释模板.md"
        );
        // 读取从生产 BaseDaoSupportImpl 提取的真实示例 → 实际字段和结果结构。
        String examples = readResource(
            "selplat/通用规则/RUL_Java业务注释与返回示例规则/examples/BaseDaoSupportImpl注释示例.md"
        );
        // 单主键真实号段示例必须存在，禁止只写返回类型。
        assertTrue(mainRule.contains("{\"id\":\"UniauthUserId\"}"));
        // 固定分页返回模板必须存在。
        assertTrue(template.contains("CommonPageResult"));
        // 前端字段匹配示例必须使用生产类中的真实字段和值。
        assertTrue(examples.contains("{\"id\":1,\"displayName\":\"新名称\"}"));
    }

    /**
     * 读取一份 UTF-8 规则资源。
     *
     * @param resourcePath 相对于 rule-engine resources 的真实路径，例如
     *     `selplat/通用规则/RUL_Java业务注释与返回示例规则.md`
     * @return 完整规则正文，例如 `# Java 业务注释与返回示例规则`
     * @throws IOException 资源流读取失败
     */
    private static String readResource(String resourcePath) throws IOException {
        // 从测试运行时类路径读取真实规则资源 → 对应 Gradle processResources 的打包结果。
        InputStream resourceStream = RuleResourceStructureTest.class
            .getClassLoader()
            .getResourceAsStream(resourcePath);
        // 资源缺失时立即失败 → 明确报告无法加载的相对路径。
        assertNotNull(resourceStream, "rule resource not found: " + resourcePath);
        try (InputStream inputStream = resourceStream) {
            // 按 UTF-8 读取完整内容 → 保留中文注释、DSL 和实际结果示例。
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
