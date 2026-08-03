package com.sp.selplat.local.code.core.rule;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 验证根、common 汇总、当前作用域、跨工程与 core 的递归索引加载边界。
 */
class LayeredRuleLoaderTest {

    /**
     * 验证旧两参数入口继续加载根索引直接登记的 core 规则。
     *
     * @throws IOException 根索引或 core 规则资源缺失
     */
    @Test
    void shouldLoadRegisteredCoreRuleWithoutActiveScope() throws IOException {
        // 无作用域和用户时请求 core 逻辑 ID → 保持迁移前调用兼容。
        LayeredRuleLoader.LoadedRule rule = LayeredRuleLoader.load(
            "CODE_JAVA_CODING_RULES",
            null
        );
        // 根索引直接登记的不可变规则必须命中 core 层。
        assertEquals("core", rule.layer());
        // 实际路径保持冻结基线位置，不随 common 分级索引移动。
        assertEquals("local/core/rule/CODE_JAVA_CODING_RULES.md", rule.resourcePath());
        // 返回真实正文而不是只返回索引占位。
        assertTrue(rule.content().contains("Java"));
    }

    /**
     * 验证没有当前工程时仍可按需加载跨工程共享规则。
     *
     * @throws IOException common 汇总、跨工程索引或规则缺失
     */
    @Test
    void shouldLoadCrossProjectRuleWithoutActiveScope() throws IOException {
        // 生命周期治理适用于所有工程 → 无 activeScope 也应通过跨工程索引命中。
        LayeredRuleLoader.LoadedRule rule = LayeredRuleLoader.load(
            "RULE_LIFECYCLE_GOVERNANCE_RULES",
            null,
            null
        );
        // 跨工程规则属于人工维护的 common 物理层。
        assertEquals("common", rule.layer());
        // 路径必须来自跨工程叶子索引，根索引不再复制该条目。
        assertEquals(
            "local/common/跨工程通用规则/RUL_规则生命周期治理规则.md",
            rule.resourcePath()
        );
    }

    /**
     * 验证 SELPLAT 作用域可以加载平台通用规则。
     *
     * @throws IOException SELPLAT 索引树或目标规则缺失
     */
    @Test
    void shouldLoadRuleFromExplicitSelplatScope() throws IOException {
        // 显式 selplat 作用域 → 只递归 SELPLAT 及其应用子索引。
        LayeredRuleLoader.LoadedRule rule = LayeredRuleLoader.load(
            "SELPLAT_PROJECT_BUILD_RULES",
            "selplat",
            null
        );
        // 当前工程规则优先于跨工程与 core，并保持 common 层标识。
        assertEquals("common", rule.layer());
        // 目标来自 SELPLAT 自己的索引，不再依赖根索引平铺。
        assertEquals(
            "local/common/selplat/通用/rule/RUL_SELPLAT工程构建规则.md",
            rule.resourcePath()
        );
    }

    /**
     * 验证一级作用域递归进入项目叶子索引。
     *
     * @throws IOException Fujitsu 或 CPMAB082 项目索引缺失
     */
    @Test
    void shouldLoadNestedProjectRuleFromFujitsuScope() throws IOException {
        // CPMAB082 规则只登记在项目叶子索引 → Fujitsu 作用域递归后命中。
        LayeredRuleLoader.LoadedRule rule = LayeredRuleLoader.load(
            "FUJITSU_CPMAB082_PROJECT_STYLE_RULES",
            "fujitsu",
            null
        );
        // 项目规则仍属于 common 物理层，但逻辑归属由项目索引表达。
        assertEquals("common", rule.layer());
        // 返回 CPMAB082 的真实主规则文件。
        assertEquals(
            "local/common/fujitsu/应用/CPMAB082/rule/RUL_CPMAB082项目风格规则.md",
            rule.resourcePath()
        );
    }

    /**
     * 验证当前作用域不能读取其他工程的规则。
     */
    @Test
    void shouldNotLoadRuleFromUnrelatedCommonScope() {
        // 当前作用域是 selplat，但请求 Fujitsu 项目规则 → 禁止扫描全部 common 工程。
        assertThrows(
            IOException.class,
            () -> LayeredRuleLoader.load(
                "FUJITSU_CPMAB082_PROJECT_STYLE_RULES",
                "selplat",
                null
            )
        );
    }

    /**
     * 验证非法用户身份在访问任何用户目录前被阻断。
     */
    @Test
    void shouldRejectUnsafeActiveUserIdentifier() {
        // 路径穿越身份不得参与根索引兼容覆盖键解析。
        assertThrows(
            IllegalArgumentException.class,
            () -> LayeredRuleLoader.load("CODE_JAVA_CODING_RULES", "../TongXiaoFeng")
        );
    }

    /**
     * 验证非法 common 作用域不能形成目录拼接。
     */
    @Test
    void shouldRejectUnsafeActiveScopeIdentifier() {
        // 含斜杠的作用域不能用于匹配 common 汇总索引。
        assertThrows(
            IllegalArgumentException.class,
            () -> LayeredRuleLoader.load(
                "SELPLAT_PROJECT_BUILD_RULES",
                "selplat/../fujitsu",
                null
            )
        );
    }

    /**
     * 验证未登记逻辑 ID 不会通过同名文件猜测加载。
     */
    @Test
    void shouldFailClosedForUnregisteredLogicalId() {
        // 所有已选层都没有 ID → 必须返回 IOException。
        assertThrows(
            IOException.class,
            () -> LayeredRuleLoader.load("UNREGISTERED_RULE", "selplat", "XUNAN")
        );
    }

    /**
     * 验证生产分级索引完整覆盖 core 和 common 主规则。
     *
     * @throws IOException 任一索引结构或目标登记异常
     */
    @Test
    void shouldValidateCompleteProductionIndexTree() throws IOException {
        // 从根递归真实索引 → 19 个索引文件和 65 个规则逻辑 ID。
        LayeredRuleLoader.IndexValidation validation = LayeredRuleLoader.validateIndexTree();
        // 根、common、一级项目、通用/应用分类和项目叶子索引必须全部可达。
        assertEquals(19, validation.indexCount());
        // 当前 core、common 与 XUNAN 规则全部拥有唯一入口。
        assertEquals(65, validation.ruleCount());
    }

    /**
     * 验证索引循环引用被闭锁阻断。
     */
    @Test
    void shouldRejectRecursiveIndexCycle() {
        // scope → child → scope 构造直接可识别的循环链。
        Map<String, String> resources = baseIndexGraph(
            "SCOPE_INDEX = local/test/cycle/scope/RULE_INDEX.md"
        );
        resources.put(
            "local/test/cycle/scope/RULE_INDEX.md",
            "CHILD_INDEX = local/test/cycle/child/RULE_INDEX.md"
        );
        resources.put(
            "local/test/cycle/child/RULE_INDEX.md",
            "BACK_INDEX = local/test/cycle/scope/RULE_INDEX.md"
        );
        // 循环必须抛出 IOException，禁止依赖最大深度才偶然终止。
        assertThrows(IOException.class, () -> validate(resources));
    }

    /**
     * 验证同一作用域树的重复逻辑 ID 被阻断。
     */
    @Test
    void shouldRejectDuplicateLogicalIdInsideOneScopeTree() {
        // 父作用域和项目子索引登记同一 ID → 无法确定唯一权威来源。
        Map<String, String> resources = baseIndexGraph(
            "SCOPE_INDEX = local/test/duplicate/scope/RULE_INDEX.md"
        );
        resources.put(
            "local/test/duplicate/scope/RULE_INDEX.md",
            "DUPLICATE_RULE = local/common/test/RUL_父规则.md\n"
                + "CHILD_INDEX = local/test/duplicate/child/RULE_INDEX.md"
        );
        resources.put(
            "local/test/duplicate/child/RULE_INDEX.md",
            "DUPLICATE_RULE = local/common/test/RUL_子规则.md"
        );
        // 重复 ID 必须报告结构错误，禁止后遍历项目静默覆盖父规则。
        assertThrows(IOException.class, () -> validate(resources));
    }

    /**
     * 验证子索引路径越界被阻断。
     */
    @Test
    void shouldRejectEscapingChildIndexPath() {
        // common 汇总引用 `..` → 不得离开 resources/local。
        Map<String, String> resources = new LinkedHashMap<>();
        resources.put("RULE_INDEX.md", "COMMON_RULE_INDEX = local/common/RULE_INDEX.md");
        resources.put(
            "local/common/RULE_INDEX.md",
            "ESCAPING_INDEX = local/common/../outside/RULE_INDEX.md"
        );
        // 越界路径在读取目标前即被拒绝。
        assertThrows(IOException.class, () -> validate(resources));
    }

    /**
     * 验证缺失子索引被阻断。
     */
    @Test
    void shouldRejectMissingChildIndex() {
        // common 汇总登记真实格式路径，但 provider 中没有对应正文。
        Map<String, String> resources = baseIndexGraph(
            "MISSING_INDEX = local/test/missing/RULE_INDEX.md"
        );
        // 读取缺失资源必须返回 IOException，禁止跳过后继续验证成功。
        assertThrows(IOException.class, () -> validate(resources));
    }

    /**
     * 验证索引递归深度超过 16 层时被阻断。
     */
    @Test
    void shouldRejectIndexDepthOverflow() {
        // 从 scope/0 连续生成 18 层索引，使最后一层深度超过允许值。
        Map<String, String> resources = baseIndexGraph(
            "DEEP_INDEX = local/test/depth/0/RULE_INDEX.md"
        );
        for (int depth = 0; depth < 18; depth++) {
            // 每层只指向下一层，专门验证深度门而不是重复或循环门。
            String current = "local/test/depth/" + depth + "/RULE_INDEX.md";
            String next = "local/test/depth/" + (depth + 1) + "/RULE_INDEX.md";
            resources.put(current, "NEXT_INDEX = " + next);
        }
        // 最深目标无需正文，因为加载器应在尝试读取前先检测 depth > 16。
        assertThrows(IOException.class, () -> validate(resources));
    }

    // 构造根与 common 汇总的最小合法骨架，并注入一条作用域索引声明。
    private static Map<String, String> baseIndexGraph(String commonIndexContent) {
        // LinkedHashMap 保持测试图声明顺序，使失败路径稳定可复核。
        Map<String, String> resources = new LinkedHashMap<>();
        // 根入口只登记 common 汇总，符合生产分级结构。
        resources.put("RULE_INDEX.md", "COMMON_RULE_INDEX = local/common/RULE_INDEX.md");
        // common 内容由具体测试声明循环、重复、缺失或深度入口。
        resources.put("local/common/RULE_INDEX.md", commonIndexContent);
        // 返回可继续补充子索引正文的内存资源图。
        return resources;
    }

    // 使用内存 provider 执行完整递归验证，避免异常 fixture 写入生产 resources。
    private static LayeredRuleLoader.IndexValidation validate(
            Map<String, String> resources) throws IOException {
        // provider 未找到路径时模拟 classpath 缺失资源异常。
        return LayeredRuleLoader.validateIndexTree(
            "RULE_INDEX.md",
            resourcePath -> {
                String content = resources.get(resourcePath);
                if (content == null) {
                    throw new IOException("test index not found: " + resourcePath);
                }
                return content;
            }
        );
    }
}
