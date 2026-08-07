package com.sp.selplat.local.code.core.rule;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 从根索引、common 汇总索引和显式当前作用域索引加载分层规则。
 *
 * <p>加载边界为当前用户 → 当前作用域 → 跨工程通用 → core；不会扫描或叠加其他
 * common 作用域。</p>
 */
public final class LayeredRuleLoader {

    // 根索引是所有 core 规则和 common 汇总索引的唯一全局入口。
    private static final String ROOT_INDEX = "RULE_INDEX.md";
    // 根索引通过该稳定键进入 common 汇总索引，禁止猜测 common 目录结构。
    private static final String COMMON_INDEX_KEY = "COMMON_RULE_INDEX";
    // common 汇总索引通过该稳定键进入跨工程共享规则基线。
    private static final String CROSS_PROJECT_INDEX_KEY = "CROSS_PROJECT_COMMON_RULE_INDEX";
    // 根索引只保存这一份用户路径模式，具体用户值必须来自工程根 AGENTS.md。
    private static final String USER_INDEX_PATTERN_KEY = "USER_RULE_INDEX_PATTERN";
    // 用户索引模式中的占位符只能由经过安全校验的当前稳定用户替换。
    private static final String USER_ID_PLACEHOLDER = "<stable-user-id>";
    // 递归最多允许 16 层，防止异常索引链耗尽调用栈或隐藏过深依赖。
    private static final int MAX_INDEX_DEPTH = 16;
    // 用户标识只允许稳定路径安全字符，阻止身份值逃逸到其他资源目录。
    private static final Pattern USER_ID_PATTERN = Pattern.compile("[A-Za-z][A-Za-z0-9_-]{0,63}");
    // 工程根 AGENTS.md 用这一行声明唯一当前稳定用户，不从目录或历史索引推断。
    private static final Pattern ACTIVE_USER_DECLARATION = Pattern.compile(
        "(?m)^- 当前稳定用户 ID：`([^`]+)`\\s*$"
    );
    // 作用域允许中英文、数字、下划线和连字符，但禁止斜杠与路径跳转。
    private static final Pattern SCOPE_PATTERN = Pattern.compile("[\\p{L}\\p{N}][\\p{L}\\p{N}_-]{0,63}");
    // 规则逻辑 ID 使用稳定大写命名，索引汇总键也复用同一安全字符集合。
    private static final Pattern LOGICAL_ID_PATTERN = Pattern.compile("[A-Z][A-Z0-9_]{1,127}");

    // 工具类不承载隐式用户或工程状态，所有选择都由调用参数显式传入。
    private LayeredRuleLoader() {
    }

    /**
     * 从工程根 {@code AGENTS.md} 读取唯一当前稳定用户。
     *
     * @return 当前稳定用户，例如根文件声明值 {@code CURRENT_USER}
     * @throws IOException 工程根、身份声明缺失，声明重复或用户 ID 不安全
     */
    public static String currentStableUserId() throws IOException {
        // 从实际工作目录逐级向上寻找工程根，禁止绑定机器绝对路径。
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null && !Files.isRegularFile(current.resolve("AGENTS.md"))) {
            current = current.getParent();
        }
        // 找不到工程根事实源时闭锁失败，禁止从 local 子目录反推用户。
        if (current == null) {
            throw new IOException("Project AGENTS.md was not found from current working directory.");
        }
        // 完整读取根文件并只接受唯一身份声明。
        String agentsText = Files.readString(current.resolve("AGENTS.md"), StandardCharsets.UTF_8);
        Matcher matcher = ACTIVE_USER_DECLARATION.matcher(agentsText);
        if (!matcher.find()) {
            throw new IOException("Current stable user id is missing in AGENTS.md.");
        }
        String activeUser = matcher.group(1).trim();
        if (matcher.find()) {
            throw new IOException("Current stable user id is declared more than once in AGENTS.md.");
        }
        // 身份值进入索引路径前必须通过统一路径安全校验。
        validateActiveUser(activeUser);
        return activeUser;
    }

    /**
     * 使用 {@code AGENTS.md} 当前稳定用户和可选 common 作用域加载规则。
     *
     * @param logicalId 稳定规则 ID，例如 {@code CODE_JAVA_CODING_RULES}
     * @param activeScope 当前 common 作用域，例如 {@code selplat}；无作用域时传 {@code null}
     * @return 实际命中的用户、common 或 core 规则
     * @throws IOException 身份、索引或规则结构无效
     */
    public static LoadedRule loadForCurrentUser(String logicalId, String activeScope)
            throws IOException {
        return load(logicalId, activeScope, currentStableUserId());
    }

    /**
     * 按当前用户 → 跨工程通用 → core 加载规则，兼容迁移前没有作用域参数的调用方。
     *
     * @param logicalId 稳定规则 ID，例如 {@code CODE_JAVA_CODING_RULES}
     * @param activeUser 与 AGENTS.md 一致的当前稳定用户；无用户层时传 {@code null}
     * @return 实际命中结果，例如
     *     {@code {logicalId=CODE_JAVA_CODING_RULES,layer=core,resourcePath=local/core/rule/CODE_JAVA_CODING_RULES.md}}
     * @throws IOException 索引、子索引或目标规则缺失，或索引结构违反安全约束
     */
    public static LoadedRule load(String logicalId, String activeUser) throws IOException {
        // 旧调用没有工程作用域 → 只允许用户显式覆盖、跨工程规则和 core 基线参与。
        return load(logicalId, null, activeUser);
    }

    /**
     * 按当前用户 → 当前 common 作用域 → 跨工程通用 → core 加载规则。
     *
     * @param logicalId 稳定规则 ID，例如 {@code SELPLAT_PROJECT_BUILD_RULES}
     * @param activeScope common 汇总索引登记的一级作用域，例如 {@code selplat} 或
     *     {@code 中文教学}；无工程作用域时传 {@code null}
     * @param activeUser 与 AGENTS.md 一致的当前稳定用户；无用户层时传 {@code null}
     * @return 实际命中结果，例如
     *     {@code {logicalId=SELPLAT_PROJECT_BUILD_RULES,layer=common,resourcePath=local/common/selplat/通用/rule/RUL_SELPLAT工程构建规则.md}}
     * @throws IOException 循环引用、重复逻辑 ID、路径越界、缺失索引、深度超限或规则缺失
     */
    public static LoadedRule load(
            String logicalId,
            String activeScope,
            String activeUser) throws IOException {
        // 首先校验逻辑 ID，保证调用方不能把任意路径作为规则入口。
        validateLogicalId(logicalId);
        // 用户和作用域都必须先通过路径安全校验，再参与任何索引选择。
        validateActiveUser(activeUser);
        validateActiveScope(activeScope);
        // 启用用户层时，调用值必须与 AGENTS.md 唯一事实源完全一致。
        if (activeUser != null && !activeUser.isBlank()
                && !currentStableUserId().equals(activeUser)) {
            throw new IOException("Active user does not match AGENTS.md: " + activeUser);
        }

        // 完整读取根索引 → 同时获得 core 直登规则、用户索引入口和 common 汇总入口。
        Map<String, String> rootEntries = parseIndex(ROOT_INDEX, readResource(ROOT_INDEX));
        // 用户规则使用独立分级索引，并且只允许递归当前一个已验证用户。
        if (activeUser != null && !activeUser.isBlank()) {
            // 根索引只登记用户索引模式，当前用户值来自 AGENTS.md 且不会触发目录扫描。
            String userIndexPath = optionalUserIndexReference(rootEntries, activeUser);
            // 用户层优先级最高；当前用户只递归这一棵已解析索引树。
            LoadedRule userRule = loadFromIndexTree(userIndexPath, logicalId, activeUser);
            // 当前用户树命中后无需继续读取任何 common 或 core 规则正文。
            if (userRule != null) {
                return userRule;
            }
        }

        // 根索引必须显式登记 common 汇总索引；缺失时禁止扫描 local/common 猜测入口。
        String commonIndexPath = requiredIndexReference(
            ROOT_INDEX,
            rootEntries,
            COMMON_INDEX_KEY
        );
        // common 汇总索引只负责路由一级作用域和跨工程共享索引。
        Map<String, String> commonEntries = parseIndex(
            commonIndexPath,
            readResource(commonIndexPath)
        );

        // 存在明确当前作用域时，只递归这一棵作用域索引树，不加载其他工程规则。
        if (activeScope != null && !activeScope.isBlank()) {
            // 作用域路径必须已登记在 common 汇总索引，禁止按目录名称直接拼接。
            String scopeIndexPath = findScopeIndex(commonIndexPath, commonEntries, activeScope);
            // 递归收集当前作用域及其项目子索引 → 同一树内重复 ID 会立即阻断。
            LoadedRule scopeRule = loadFromIndexTree(scopeIndexPath, logicalId, "common");
            // 当前作用域规则优先于跨工程共享基线。
            if (scopeRule != null) {
                return scopeRule;
            }
        }

        // 无论是否指定工程作用域，都允许按需命中跨工程共享规则。
        String crossProjectIndexPath = requiredIndexReference(
            commonIndexPath,
            commonEntries,
            CROSS_PROJECT_INDEX_KEY
        );
        // 跨工程索引只在逻辑 ID 命中时返回，不会全量装载规则正文。
        LoadedRule crossProjectRule = loadFromIndexTree(
            crossProjectIndexPath,
            logicalId,
            "common"
        );
        // 跨工程规则存在时优先于冻结 core 基线。
        if (crossProjectRule != null) {
            return crossProjectRule;
        }

        // 兼容迁移期显式 `<LOGICAL_ID>@common` 根登记，但新索引不得继续新增这种条目。
        LoadedRule legacyCommonRule = loadRegistered(
            rootEntries,
            logicalId + "@common",
            logicalId,
            "common"
        );
        // 仅当历史兼容条目真实存在时返回，不通过目录扫描补齐。
        if (legacyCommonRule != null) {
            return legacyCommonRule;
        }

        // 根索引默认规则只能命中冻结 core，common 规则必须从分级索引进入。
        LoadedRule coreRule = loadRegistered(
            rootEntries,
            logicalId,
            logicalId,
            "core"
        );
        // 所有层都未登记时闭锁失败，禁止猜测同名文件。
        if (coreRule == null) {
            throw new IOException("Rule logical id is not registered for active scope: " + logicalId);
        }
        // 返回根索引直接登记的不可变 core 规则。
        return coreRule;
    }

    /**
     * 验证根、common 汇总和每个作用域索引树，不读取规则正文。
     *
     * @return 索引和规则登记计数，例如 {@code {indexCount=19,ruleCount=65}}
     * @throws IOException 任一索引循环、重复、越界、缺失或深度超过 16 层
     */
    public static IndexValidation validateIndexTree() throws IOException {
        // 生产验证统一读取打包后的真实 classpath 资源。
        return validateIndexTree(ROOT_INDEX, LayeredRuleLoader::readResource);
    }

    /**
     * 验证一个已登记用户的完整递归索引树，不把用户规则混入 core/common 统计。
     *
     * @param activeUser 与 AGENTS.md 一致的当前稳定用户
     * @return 当前用户索引和逻辑 ID 数，例如 {@code {indexCount=7,ruleCount=4}}
     * @throws IOException 用户入口缺失、索引循环、重复、越界或目标路径非法
     */
    public static IndexValidation validateUserIndexTree(String activeUser) throws IOException {
        // 用户 ID 先经过统一路径安全校验。
        validateActiveUser(activeUser);
        // 空用户无法形成明确验证目标，必须阻断。
        if (activeUser == null || activeUser.isBlank()) {
            throw new IllegalArgumentException("Active user is required for user index validation.");
        }
        // 只允许验证 AGENTS.md 当前用户，禁止把测试或调用参数变成跨用户扫描入口。
        if (!currentStableUserId().equals(activeUser)) {
            throw new IOException("Active user does not match AGENTS.md: " + activeUser);
        }
        // 用户入口只能从正式根索引取得，禁止根据目录存在性猜测。
        Map<String, String> rootEntries = parseIndex(ROOT_INDEX, readResource(ROOT_INDEX));
        String userIndexPath = optionalUserIndexReference(rootEntries, activeUser);
        // 独立集合记录这棵用户树的真实索引数量。
        Set<String> userIndexPaths = new LinkedHashSet<>();
        // 递归收集全部用户规则，同时执行循环、重复和路径边界校验。
        Map<String, RuleRegistration> userRules = collectRuleEntries(
            userIndexPath,
            0,
            new LinkedHashSet<>(),
            new HashSet<>(),
            userIndexPaths,
            LayeredRuleLoader::readResource
        );
        // 返回独立用户指标，便于迁移和提升前验证完整性。
        return new IndexValidation(userIndexPaths.size(), userRules.size());
    }

    /**
     * 验证 {@code AGENTS.md} 当前稳定用户的完整递归索引树。
     *
     * @return 当前用户索引和逻辑 ID 数，例如 {@code {indexCount=7,ruleCount=4}}
     * @throws IOException 身份声明、用户索引或规则登记无效
     */
    public static IndexValidation validateCurrentUserIndexTree() throws IOException {
        return validateUserIndexTree(currentStableUserId());
    }

    // 测试入口允许用内存资源构造循环、重复、越界、缺失和深度异常，不污染生产 resources。
    static IndexValidation validateIndexTree(
            String rootIndexPath,
            ResourceProvider resourceProvider) throws IOException {
        // 根入口本身允许位于类路径根或测试命名空间，但其所有子索引仍必须位于 local 下。
        Map<String, String> rootEntries = parseIndex(
            rootIndexPath,
            resourceProvider.read(rootIndexPath)
        );
        // 统计根索引的直接规则，确保 core 逻辑 ID 保持平铺可达。
        Map<String, RuleRegistration> rootRules = directRuleEntries(rootIndexPath, rootEntries);
        // common 汇总索引必须由根稳定键显式引用。
        String commonIndexPath = requiredIndexReference(
            rootIndexPath,
            rootEntries,
            COMMON_INDEX_KEY
        );
        // 读取 common 汇总入口并确认其只汇总子索引。
        Map<String, String> commonEntries = parseIndex(
            commonIndexPath,
            resourceProvider.read(commonIndexPath)
        );
        // common 汇总层不得直接登记规则，否则会重新形成根级平铺。
        if (!directRuleEntries(commonIndexPath, commonEntries).isEmpty()) {
            throw new IOException("Common aggregate index must contain child indexes only: "
                + commonIndexPath);
        }

        // 全局索引集合用于返回真实计数；不同作用域分别校验，允许未来显式同 ID 覆盖。
        Set<String> allIndexPaths = new LinkedHashSet<>();
        allIndexPaths.add(rootIndexPath);
        allIndexPaths.add(commonIndexPath);
        // 规则计数先包含根索引的 core 直接登记。
        int ruleCount = rootRules.size();
        // common 汇总索引的每个大写 RULE_INDEX 引用都代表一棵独立作用域树。
        List<String> scopeIndexPaths = childIndexReferences(commonIndexPath, commonEntries);
        // 没有任何作用域属于无效 common 汇总，必须阻断而不是返回空公共层。
        if (scopeIndexPaths.isEmpty()) {
            throw new IOException("Common aggregate index has no child scope indexes: "
                + commonIndexPath);
        }
        // 每棵作用域树独立检测重复 ID；跨作用域同 ID 留给显式作用域优先级裁决。
        for (String scopeIndexPath : scopeIndexPaths) {
            // 当前树使用独立 visited 和 stack，既检测循环也检测同一子索引被重复引用。
            Map<String, RuleRegistration> scopeRules = collectRuleEntries(
                scopeIndexPath,
                0,
                new LinkedHashSet<>(),
                new HashSet<>(),
                allIndexPaths,
                resourceProvider
            );
            // 汇总登记数用于验证迁移前后没有丢失主规则入口。
            ruleCount += scopeRules.size();
        }
        // 返回真实索引文件数和规则逻辑 ID 登记数供测试及诊断展示。
        return new IndexValidation(allIndexPaths.size(), ruleCount);
    }

    // 从一棵已选作用域索引树加载逻辑 ID；未命中返回 null 供优先级链继续回落。
    private static LoadedRule loadFromIndexTree(
            String indexPath,
            String logicalId,
            String expectedLayer) throws IOException {
        // 收集整棵已选树以同时执行循环、重复、越界、缺失和深度校验。
        Map<String, RuleRegistration> rules = collectRuleEntries(
            indexPath,
            0,
            new LinkedHashSet<>(),
            new HashSet<>(),
            new LinkedHashSet<>(),
            LayeredRuleLoader::readResource
        );
        // 当前逻辑 ID 未在该作用域登记时不构成错误，由下一优先级继续解析。
        RuleRegistration registration = rules.get(logicalId);
        if (registration == null) {
            return null;
        }
        // 目标规则路径仍需执行物理层校验，再读取完整 UTF-8 正文。
        return loadRule(logicalId, registration.resourcePath(), expectedLayer);
    }

    // 递归收集一棵作用域树的规则登记，并对结构异常闭锁失败。
    private static Map<String, RuleRegistration> collectRuleEntries(
            String indexPath,
            int depth,
            Set<String> recursionStack,
            Set<String> visitedIndexes,
            Set<String> allIndexPaths,
            ResourceProvider resourceProvider) throws IOException {
        // 深度从 0 开始，超过 16 层说明索引结构异常或存在规避循环检测的链。
        if (depth > MAX_INDEX_DEPTH) {
            throw new IOException("Rule index depth exceeds " + MAX_INDEX_DEPTH + ": " + indexPath);
        }
        // 所有递归子索引都必须位于 local 下并使用标准 RULE_INDEX.md 文件名。
        validateIndexResourcePath(indexPath);
        // 当前递归栈再次出现同一路径代表直接或间接循环。
        if (!recursionStack.add(indexPath)) {
            throw new IOException("Rule index cycle detected: " + indexPath);
        }
        // 同一棵树从不同父节点重复引用同一索引会造成不透明的多路径归属，必须阻断。
        if (!visitedIndexes.add(indexPath)) {
            throw new IOException("Rule index referenced more than once: " + indexPath);
        }
        // 记录所有真实读取的索引路径，供完整树验证返回计数。
        allIndexPaths.add(indexPath);
        try {
            // 读取并解析当前索引；文件缺失由 provider 返回明确 IOException。
            Map<String, String> entries = parseIndex(
                indexPath,
                resourceProvider.read(indexPath)
            );
            // 当前树结果保持索引声明顺序，便于错误定位和稳定诊断。
            Map<String, RuleRegistration> rules = new LinkedHashMap<>();
            // 先登记当前索引直接拥有的规则，再合并项目子索引。
            mergeRules(rules, directRuleEntries(indexPath, entries));
            // 逐个递归当前索引显式引用的子项目索引。
            for (String childIndexPath : childIndexReferences(indexPath, entries)) {
                Map<String, RuleRegistration> childRules = collectRuleEntries(
                    childIndexPath,
                    depth + 1,
                    recursionStack,
                    visitedIndexes,
                    allIndexPaths,
                    resourceProvider
                );
                // 同一作用域树内重复逻辑 ID 无法确定唯一项目归属，必须闭锁失败。
                mergeRules(rules, childRules);
            }
            // 返回当前索引及其全部子索引的唯一规则登记。
            return rules;
        } finally {
            // 离开当前递归节点时移除栈标记，使兄弟分支能够正确检测自己的循环链。
            recursionStack.remove(indexPath);
        }
    }

    // 把当前索引的直接主规则条目提取为逻辑 ID 到来源索引、资源路径的登记。
    private static Map<String, RuleRegistration> directRuleEntries(
            String indexPath,
            Map<String, String> entries) throws IOException {
        // 保持索引内声明顺序，便于验证输出与原文件一致。
        Map<String, RuleRegistration> rules = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : entries.entrySet()) {
            // 只有稳定大写逻辑 ID 才可能成为规则或子索引入口；小写路由条件不参与加载登记。
            if (!LOGICAL_ID_PATTERN.matcher(entry.getKey()).matches()) {
                continue;
            }
            // 子索引由递归逻辑处理，不得同时被当作规则正文。
            if (isIndexReference(entry.getValue())) {
                continue;
            }
            // 非 Markdown 元数据不是规则登记，例如状态或语言列表。
            if (!entry.getValue().endsWith(".md")) {
                continue;
            }
            // 规则正文必须位于 local 分层内，禁止旧布局和路径穿越重新进入生产。
            validateRuleResourcePath(entry.getValue());
            // 同一文件内重复键已经由 parseIndex 阻断，此处形成稳定登记结构。
            rules.put(
                entry.getKey(),
                new RuleRegistration(indexPath, entry.getValue())
            );
        }
        // 返回当前索引直接拥有的规则，不包含任何子索引内容。
        return rules;
    }

    // 从当前索引提取所有显式子索引引用。
    private static List<String> childIndexReferences(
            String indexPath,
            Map<String, String> entries) throws IOException {
        // 使用列表保持父索引声明顺序，便于诊断递归链。
        List<String> childIndexes = new ArrayList<>();
        for (Map.Entry<String, String> entry : entries.entrySet()) {
            // 只有大写稳定键且值为标准 RULE_INDEX.md 时才属于机器可递归入口。
            if (!LOGICAL_ID_PATTERN.matcher(entry.getKey()).matches()
                    || !isIndexReference(entry.getValue())) {
                continue;
            }
            // 每个子索引必须位于 local 内，禁止绝对路径、反斜杠和 `..`。
            validateIndexResourcePath(entry.getValue());
            // 保存已验证路径供调用方按声明顺序递归。
            childIndexes.add(entry.getValue());
        }
        // 返回当前索引直接引用的下一级索引列表。
        return childIndexes;
    }

    // 合并同一作用域树内的规则登记；重复逻辑 ID 立即阻断并报告两个来源索引。
    private static void mergeRules(
            Map<String, RuleRegistration> target,
            Map<String, RuleRegistration> additions) throws IOException {
        for (Map.Entry<String, RuleRegistration> entry : additions.entrySet()) {
            // putIfAbsent 同时保留第一来源，便于异常展示冲突双方。
            RuleRegistration existing = target.putIfAbsent(entry.getKey(), entry.getValue());
            // 同一作用域树禁止靠遍历顺序覆盖相同逻辑 ID。
            if (existing != null) {
                throw new IOException(
                    "Duplicate rule logical id in one scope tree: " + entry.getKey()
                        + ", first=" + existing.indexPath()
                        + ", second=" + entry.getValue().indexPath()
                );
            }
        }
    }

    // 从 common 汇总索引按已验证一级作用域精确查找登记路径。
    private static String findScopeIndex(
            String commonIndexPath,
            Map<String, String> commonEntries,
            String activeScope) throws IOException {
        // 期望物理路径只用于比对显式登记，绝不会直接读取拼接结果。
        String expectedPath = "local/common/" + activeScope + "/RULE_INDEX.md";
        for (Map.Entry<String, String> entry : commonEntries.entrySet()) {
            // 只接受标准大写子索引入口且路径与当前作用域完全一致。
            if (LOGICAL_ID_PATTERN.matcher(entry.getKey()).matches()
                    && isIndexReference(entry.getValue())
                    && expectedPath.equals(entry.getValue())) {
                // 返回 common 汇总索引真实登记值，证明作用域不是调用方猜测出来的。
                return entry.getValue();
            }
        }
        // 未登记作用域必须闭锁失败，禁止扫描其他工程目录寻找同名规则。
        throw new IOException(
            "Active common scope is not registered in " + commonIndexPath + ": " + activeScope
        );
    }

    // 读取指定稳定键的子索引路径，缺失或路径非法时闭锁失败。
    private static String requiredIndexReference(
            String ownerIndexPath,
            Map<String, String> entries,
            String indexKey) throws IOException {
        // 父索引必须明确声明该键，加载器不根据目录结构补默认值。
        String indexPath = entries.get(indexKey);
        if (indexPath == null) {
            throw new IOException(
                "Required child index is not registered: owner=" + ownerIndexPath
                    + ", key=" + indexKey
            );
        }
        // 目标必须是 local 下的标准索引，防止把普通 Markdown 当作递归入口。
        validateIndexResourcePath(indexPath);
        // 返回已验证的类路径相对地址。
        return indexPath;
    }

    // 从根索引模式解析当前用户的唯一递归入口；不扫描任何用户目录。
    private static String optionalUserIndexReference(
            Map<String, String> rootEntries,
            String activeUser) throws IOException {
        // 根索引必须只提供统一模式，禁止恢复 `USER_RULE_INDEX@具体用户` 条目。
        String indexPattern = rootEntries.get(USER_INDEX_PATTERN_KEY);
        if (indexPattern == null || !indexPattern.contains(USER_ID_PLACEHOLDER)) {
            throw new IOException("User index pattern is missing or invalid in root index.");
        }
        // 只替换一个已验证占位符，形成当前用户的确定索引路径。
        String indexPath = indexPattern.replace(USER_ID_PLACEHOLDER, activeUser);
        String expectedPath = "local/" + activeUser + "/RULE_INDEX.md";
        if (!expectedPath.equals(indexPath)) {
            throw new IOException(
                "Active user index path mismatch: user=" + activeUser + ", path=" + indexPath
            );
        }
        // 最终执行统一索引路径安全校验。
        validateIndexResourcePath(indexPath);
        // 返回根索引真实登记值供递归加载。
        return indexPath;
    }

    // 根据根索引兼容键加载单条规则；键不存在时返回 null 供优先级链回落。
    private static LoadedRule loadRegistered(
            Map<String, String> index,
            String indexKey,
            String logicalId,
            String expectedLayer) throws IOException {
        // 读取显式登记路径，不执行任何目录或同名文件推断。
        String resourcePath = index.get(indexKey);
        if (resourcePath == null) {
            return null;
        }
        // 兼容条目仍必须满足统一物理层约束。
        return loadRule(logicalId, resourcePath, expectedLayer);
    }

    // 校验规则物理层并读取完整正文。
    private static LoadedRule loadRule(
            String logicalId,
            String resourcePath,
            String expectedLayer) throws IOException {
        // 所有规则正文必须位于 local 分层并且不是索引文件。
        validateRuleResourcePath(resourcePath);
        // 从 local 后的第二段识别 core、common 或用户物理层。
        String[] pathParts = resourcePath.split("/", 3);
        if (pathParts.length < 3) {
            throw new IOException("Invalid layered rule path: " + resourcePath);
        }
        // 实际层必须与当前优先级期望完全一致，防止跨用户或跨层污染。
        String actualLayer = pathParts[1];
        if (expectedLayer != null && !expectedLayer.equals(actualLayer)) {
            throw new IOException(
                "Rule layer mismatch: expected=" + expectedLayer + ", path=" + resourcePath
            );
        }
        // 读取目标 UTF-8 全文；资源缺失由统一读取函数返回真实路径。
        String content = readResource(resourcePath);
        // 返回逻辑 ID、实际层、物理路径和完整规则正文。
        return new LoadedRule(logicalId, actualLayer, resourcePath, content);
    }

    // 解析 Markdown 索引中的 `key = value` DSL，重复键立即阻断。
    private static Map<String, String> parseIndex(
            String indexPath,
            String content) throws IOException {
        // LinkedHashMap 保留声明顺序，便于错误信息与源文件逐行对应。
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : content.split("\\R")) {
            // 去除外围空白后跳过标题、注释、说明和空行。
            String trimmedLine = line.trim();
            if (trimmedLine.isEmpty() || trimmedLine.startsWith("#")
                    || trimmedLine.startsWith("<!--") || !trimmedLine.contains("=")) {
                continue;
            }
            // 只按第一个等号拆分，保留值中可能存在的配置等号。
            String[] parts = trimmedLine.split("=", 2);
            String key = parts[0].trim();
            String value = parts[1].trim();
            // 空键或空值无法形成稳定机器索引，必须明确阻断。
            if (key.isEmpty() || value.isEmpty()) {
                throw new IOException("Empty index key or value in " + indexPath + ": " + line);
            }
            // 同一索引重复键会产生遍历顺序覆盖，因此禁止后值静默替换前值。
            if (values.putIfAbsent(key, value) != null) {
                throw new IOException("Duplicate index key in " + indexPath + ": " + key);
            }
        }
        // 返回包含规则、子索引、路由和元数据的完整 DSL 映射。
        return values;
    }

    // 校验逻辑 ID 的稳定机器格式。
    private static void validateLogicalId(String logicalId) {
        if (logicalId == null || !LOGICAL_ID_PATTERN.matcher(logicalId).matches()) {
            throw new IllegalArgumentException("Invalid rule logical id: " + logicalId);
        }
    }

    // 校验当前用户；空值表示不启用用户覆盖层。
    private static void validateActiveUser(String activeUser) {
        if (activeUser != null && !activeUser.isBlank()
                && !USER_ID_PATTERN.matcher(activeUser).matches()) {
            throw new IllegalArgumentException("Invalid active user id: " + activeUser);
        }
    }

    // 校验当前 common 一级作用域；中文工程名可以使用，但路径分隔符永远禁止。
    private static void validateActiveScope(String activeScope) {
        if (activeScope != null && !activeScope.isBlank()
                && !SCOPE_PATTERN.matcher(activeScope).matches()) {
            throw new IllegalArgumentException("Invalid active common scope: " + activeScope);
        }
    }

    // 判断值是否为标准子索引引用。
    private static boolean isIndexReference(String resourcePath) {
        return resourcePath != null && resourcePath.endsWith("/RULE_INDEX.md");
    }

    // 校验索引资源严格位于 local 下且文件名为 RULE_INDEX.md。
    private static void validateIndexResourcePath(String resourcePath) throws IOException {
        if (!isSafeLocalResourcePath(resourcePath) || !isIndexReference(resourcePath)) {
            throw new IOException("Invalid or escaping child rule index path: " + resourcePath);
        }
    }

    // 校验规则正文严格位于 local 下、以 Markdown 结尾且不是索引文件。
    private static void validateRuleResourcePath(String resourcePath) throws IOException {
        if (!isSafeLocalResourcePath(resourcePath) || !resourcePath.endsWith(".md")
                || isIndexReference(resourcePath)) {
            throw new IOException("Invalid or escaping layered rule path: " + resourcePath);
        }
    }

    // 检查类路径相对地址没有绝对路径、反斜杠、空段、`.` 或 `..` 跳转。
    private static boolean isSafeLocalResourcePath(String resourcePath) {
        if (resourcePath == null || !resourcePath.startsWith("local/")
                || resourcePath.startsWith("/") || resourcePath.contains("\\")) {
            return false;
        }
        // 每一段必须是实际目录或文件名，禁止通过标准化前的路径逃逸。
        for (String segment : resourcePath.split("/", -1)) {
            if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) {
                return false;
            }
        }
        return true;
    }

    // 从应用类路径读取 UTF-8 资源，缺失时以真实路径阻断。
    private static String readResource(String resourcePath) throws IOException {
        // Gradle 标准 resources source set 与生产打包结果使用同一类路径入口。
        try (InputStream inputStream = LayeredRuleLoader.class
                .getClassLoader()
                .getResourceAsStream(resourcePath)) {
            if (inputStream == null) {
                throw new IOException("Rule resource not found: " + resourcePath);
            }
            // 完整读取中文注释、DSL 和规则正文，不使用平台默认编码。
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    /**
     * 表示一次经过分级索引和物理层校验的规则加载结果。
     *
     * @param logicalId 请求的稳定 ID，例如 {@code SELPLAT_PROJECT_BUILD_RULES}
     * @param layer 实际命中层，例如 {@code core}、{@code common} 或当前稳定用户 ID
     * @param resourcePath resources 相对路径，例如
     *     {@code local/common/selplat/通用/rule/RUL_SELPLAT工程构建规则.md}
     * @param content 完整 UTF-8 规则正文，例如以 {@code # SELPLAT 工程构建规则} 开头
     */
    public record LoadedRule(String logicalId, String layer, String resourcePath, String content) {
    }

    /**
     * 表示完整分级索引验证结果。
     *
     * @param indexCount 从根入口实际到达的索引文件数，例如 {@code 19}
     * @param ruleCount 根 core 与全部 common 作用域登记的规则 ID 数，例如 {@code 65}
     */
    public record IndexValidation(int indexCount, int ruleCount) {
    }

    // 内部登记同时保存叶子索引和规则路径，使重复 ID 异常能够展示冲突双方。
    private record RuleRegistration(String indexPath, String resourcePath) {
    }

    // 可替换资源读取器只用于同包测试构造异常索引图，生产入口固定使用 classpath。
    @FunctionalInterface
    interface ResourceProvider {
        // 根据类路径相对地址返回完整 UTF-8 索引正文；缺失时抛出 IOException。
        String read(String resourcePath) throws IOException;
    }
}
