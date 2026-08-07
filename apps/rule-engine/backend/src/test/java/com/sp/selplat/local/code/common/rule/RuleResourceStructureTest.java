package com.sp.selplat.local.code.common.rule;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * 验证项目规则使用 rule 与可选 template 分层，并确保 Java 注释规则的真实模板和实际返回示例可以加载。
 */
class RuleResourceStructureTest {

    /**
     * 验证根索引只汇总 common，具体规则由所属作用域或项目索引指向主文件。
     *
     * 执行结果示例：SELPLAT 索引包含
     * `SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES =
     * local/common/selplat/通用/rule/RUL_Java业务注释与返回示例规则.md`，
     * 且不包含 `RUL_Java业务注释与返回示例规则/RUL_Java业务注释与返回示例规则.md`。
     *
     * @throws IOException 规则索引读取失败
     */
    @Test
    void shouldReferenceLayeredMainRuleFilesFromLeafIndexes() throws IOException {
        // 读取根索引 → 只保留 core 直登和 common 汇总入口。
        String rootIndex = readResource("RULE_INDEX.md");
        // 读取 common 汇总索引 → 只引用四个一级规则作用域。
        String commonIndex = readResource("local/common/RULE_INDEX.md");
        // 读取跨工程叶子索引 → 生命周期规则唯一登记位置。
        String crossProjectIndex = readResource(
            "local/common/跨工程通用规则/RULE_INDEX.md"
        );
        // 读取 SELPLAT 项目索引 → 只汇总通用和应用两类子索引。
        String selplatIndex = readResource("local/common/selplat/RULE_INDEX.md");
        // 读取 SELPLAT 通用叶子索引 → 平台通用规则唯一登记位置。
        String selplatGeneralIndex = readResource(
            "local/common/selplat/通用/RULE_INDEX.md"
        );
        // 读取 rule-engine 项目索引 → 分层治理规则唯一登记位置。
        String ruleEngineIndex = readResource(
            "local/common/selplat/应用/rule-engine/RULE_INDEX.md"
        );
        // 根索引只允许通过 common 汇总入口进入所有公共作用域。
        assertTrue(rootIndex.contains("COMMON_RULE_INDEX = local/common/RULE_INDEX.md"));
        // 根索引不得继续复制跨工程或 SELPLAT 的 common 主规则条目。
        assertFalse(rootIndex.contains("RULE_LIFECYCLE_GOVERNANCE_RULES ="));
        assertFalse(rootIndex.contains("SELPLAT_PROJECT_BUILD_RULES ="));
        // common 汇总必须显式登记 SELPLAT 作用域索引。
        assertTrue(commonIndex.contains(
            "SELPLAT_RULE_INDEX = local/common/selplat/RULE_INDEX.md"
        ));
        // SELPLAT 项目索引必须只进入通用和应用分类。
        assertTrue(selplatIndex.contains(
            "SELPLAT_GENERAL_RULE_INDEX = local/common/selplat/通用/RULE_INDEX.md"
        ));
        assertTrue(selplatIndex.contains(
            "SELPLAT_APPLICATION_RULE_INDEX = local/common/selplat/应用/RULE_INDEX.md"
        ));
        // Java 注释主规则必须由 SELPLAT 通用叶子索引登记。
        assertTrue(selplatGeneralIndex.contains(
            "SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES = "
                + "local/common/selplat/通用/rule/RUL_Java业务注释与返回示例规则.md"
        ));
        // 跨工程通用规则是分类例外，生命周期主规则继续直接位于该根目录。
        assertTrue(crossProjectIndex.contains(
            "RULE_LIFECYCLE_GOVERNANCE_RULES = local/common/跨工程通用规则/RUL_规则生命周期治理规则.md"
        ));
        // 基础 DAO 主规则必须直接位于 SELPLAT 通用规则根 → 同名目录只保留 README 等资产。
        assertTrue(selplatGeneralIndex.contains(
            "SELPLAT_BASE_DAO_REUSE_RULES = local/common/selplat/通用/rule/RUL_基础DAO复用与通用参数透传规则.md"
        ));
        // 分层治理规则必须由 rule-engine 项目叶子索引唯一登记。
        assertTrue(ruleEngineIndex.contains(
            "RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES = "
                + "local/common/selplat/应用/rule-engine/rule/RUL_本地规则引擎CoreCommon用户分层治理规则.md"
        ));
        // 生命周期主规则不得继续使用“同名目录内再放同名主规则”的错误嵌套路径。
        assertFalse(crossProjectIndex.contains(
            "RUL_规则生命周期治理规则/RUL_规则生命周期治理规则.md"
        ));
        // 基础 DAO 主规则也必须完成并列结构迁移。
        assertFalse(selplatGeneralIndex.contains(
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
            "local/common/selplat/通用/rule/RUL_Java业务注释与返回示例规则.md"
        );
        // 读取通用/template/<规则名称> 中的真实模板 → JavaDoc 与逐行业务注释骨架。
        String template = readResource(
            "local/common/selplat/通用/template/RUL_Java业务注释与返回示例规则/template/Java业务注释模板.md"
        );
        // 读取从生产 BaseDaoSupportImpl 提取的真实示例 → 实际字段和结果结构。
        String examples = readResource(
            "local/common/selplat/通用/template/RUL_Java业务注释与返回示例规则/examples/BaseDaoSupportImpl注释示例.md"
        );
        // 单主键真实号段示例必须存在，禁止只写返回类型。
        assertTrue(mainRule.contains("{\"id\":\"UniauthUserId\"}"));
        // 固定分页返回模板必须存在。
        assertTrue(template.contains("CommonPageResult"));
        // 前端字段匹配示例必须使用生产类中的真实字段和值。
        assertTrue(examples.contains("{\"id\":1,\"displayName\":\"新名称\"}"));
        // 主规则必须固定方法作用、参数、返回和异常或副作用的统一阅读顺序。
        assertTrue(mainRule.contains("purpose_and_boundary,param_source_meaning_actual_example,"));
        // 模板必须分别展示公共业务异常和系统异常，禁止继续只使用不分类的 JDK 异常。
        assertTrue(template.contains("CommonBusinessException(\"RECORD_NOT_FOUND\""));
        assertTrue(template.contains("CommonSystemException("));
        // 生产样例必须明确异常类型与 HTTP 处理器分层，避免 common-core 反向依赖 common-web。
        assertTrue(examples.contains("异常类型由 `common-core` 提供，Web 映射由 `common-web` 提供"));
    }

    /**
     * 验证基础 DAO 规则使用项目 BaseDao 中间层，并明确包目录、类型与数据库表的映射。
     *
     * @throws IOException 基础 DAO 规则资源读取失败
     */
    @Test
    void shouldLoadProjectBaseDaoAndFixedTableNamingRules() throws IOException {
        // 读取基础 DAO 公共规则 → 同时验证继承结构与固定表命名映射。
        String baseDaoRule = readResource(
            "local/common/selplat/通用/rule/RUL_基础DAO复用与通用参数透传规则.md"
        );
        // 具体 DAO 必须经项目 BaseDao 接入公共 BaseDaoImpl，禁止恢复旧的直接继承结构。
        assertTrue(baseDaoRule.contains(
            "selplat_application_dao_inheritance_chain = ConcreteDaoImpl extends ProjectBaseDao extends BaseDaoImpl"
        ));
        // 包目录只表达小写业务资源名，数据库表归属由实体和 DAO 类型名称表达。
        assertTrue(baseDaoRule.contains(
            "selplat_business_package_directory_pattern = lowercase_business_resource_name"
        ));
        // 固定表、实体类与 DAO 去后缀名称必须一一对应。
        assertTrue(baseDaoRule.contains(
            "selplat_fixed_table_type_mapping = databaseTableName == entitySimpleName "
                + "== removeSuffix(concreteDaoSimpleName,DaoImpl)"
        ));
        // 表名不得从全小写包目录猜测，避免 user 被错误当成物理表名。
        assertTrue(baseDaoRule.contains(
            "selplat_package_directory_must_not_determine_table_name = true"
        ));
    }

    /**
     * 验证规则引擎分层治理规则声明稳定的加载顺序、冲突优先级和写入边界。
     *
     * 执行结果示例：规则正文包含 `core -> common -> active_user`、
     * `active_user > common > core` 和 `manual_reviewed_merge_only`。
     *
     * @throws IOException 分层治理规则资源读取失败，例如资源未被 Gradle 打包
     */
    @Test
    void shouldLoadLocalCoreCommonAndActiveUserLayerGovernance() throws IOException {
        // 从正式资源入口读取分层治理规则 → 后续迁移和运行时路由共享同一份约束。
        String layerRule = readResource(
            "local/common/selplat/应用/rule-engine/rule/RUL_本地规则引擎CoreCommon用户分层治理规则.md"
        );
        // 固定加载顺序必须先建立不可变基础，再叠加公共层和当前用户层。
        assertTrue(layerRule.contains("local/core -> local/common -> local/active_user"));
        // 冲突优先级必须让当前用户修正覆盖公共层，公共层再覆盖核心基线。
        assertTrue(layerRule.contains("local/active_user > local/common > local/core"));
        // common 只能接收人工审查后的手工合并，自动修正不得越权写入。
        assertTrue(layerRule.contains("manual_reviewed_merge_only"));
        // core 冻结后必须完全禁止写入，避免迁移后的基础事实被修正流程改写。
        assertTrue(layerRule.contains("rule_engine_core_after_freeze_write_policy = forbidden"));
        // Python 必须保留原语言进入标准 Python source root，并使用与 Java 相同的层名。
        assertTrue(layerRule.contains(
            "rule_engine_python_layer_root = src/main/python/com/sp/selplat/local/code/<layer>/"
        ));
        // Node 必须保留原语言进入标准 Node source root，并使用与其他语言相同的层名。
        assertTrue(layerRule.contains(
            "rule_engine_node_layer_root = src/main/node/com/sp/selplat/local/code/<layer>/"
        ));
        // 新治理禁止继续要求 Python/Node 为目录统一而强制移植成 Java。
        assertFalse(layerRule.contains("port_to_java_with_equivalence_test"));
    }

    /**
     * 读取一份 UTF-8 规则资源。
     *
     * @param resourcePath 相对于 rule-engine resources 的真实路径，例如
     *     `local/common/selplat/通用/rule/RUL_Java业务注释与返回示例规则.md`
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
