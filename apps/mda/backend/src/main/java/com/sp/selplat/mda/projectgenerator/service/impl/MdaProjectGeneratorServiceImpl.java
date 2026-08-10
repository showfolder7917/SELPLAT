package com.sp.selplat.mda.projectgenerator.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.mda.projectgenerator.model.MdaProjectGenerationData;
import com.sp.selplat.mda.projectgenerator.model.MdaProjectNames;
import com.sp.selplat.mda.projectgenerator.service.MdaProjectGeneratorService;
import com.sp.selplat.mda.projectgenerator.template.MdaProjectTemplateCatalog;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;

/**
 * 根据从 Uniauth 提炼的固定分层生成 SELPLAT 应用和可追加业务表。
 * 生成器只写入当前 SELPLAT 根内的受控文件，并在任何目标冲突时拒绝覆盖。
 */
@Service
public class MdaProjectGeneratorServiceImpl implements MdaProjectGeneratorService {

    // 工程和表编码只接受可稳定映射到目录、Java 包及 URL 的小写短横线格式。
    private static final Pattern CODE_PATTERN = Pattern.compile("[a-z][a-z0-9-]{0,31}");
    // 当前稳定用户只能来自根 AGENTS.md，中央登记路径不得写死具体用户名。
    private static final Pattern STABLE_USER_PATTERN = Pattern.compile(
            "(?m)^- 当前稳定用户 ID：`([^`]+)`\\s*$");
    // 统一使用 Jackson 维护中央 JSON，避免字符串拼接破坏登记结构。
    private static final ObjectMapper JSON = new ObjectMapper();
    // 此标记区分生成器拥有的工程与用户手工建立的同名目录。
    private static final String OWNERSHIP_MARKER = ".selplat-generated-project.json";
    // 根构建登记使用固定注释，后续追加和重复校验不依赖脆弱的行号。
    private static final String SETTINGS_ANCHOR = "// SELPLAT-GENERATED-MODULES";
    // Host 依赖登记使用固定注释，生成模块不会进入其他 Gradle 配置区。
    private static final String HOST_ANCHOR = "    // SELPLAT-GENERATED-MODULES";
    // Desktop 内部路径登记使用固定注释，避免生成器依赖 JavaScript 数组行号。
    private static final String DESKTOP_PATH_ANCHOR = "// SELPLAT-GENERATED-APPLICATION-PATHS";
    // 当前服务绑定的唯一 SELPLAT 工程根。
    private final Path projectRoot;

    /**
     * 从当前进程工作目录向上定位包含 settings.gradle 和 apps/mda 的 SELPLAT 根。
     *
     * @throws CommonSystemException 当运行目录不属于 SELPLAT 时抛出，例如
     *     {@code CommonSystemException("MDA_PROJECT_ROOT_NOT_FOUND", "无法定位 SELPLAT 工程根。")}
     */
    public MdaProjectGeneratorServiceImpl() {
        this(locateProjectRoot(Path.of(System.getProperty("user.dir"))));
    }

    /**
     * 为真实文件系统测试绑定隔离工程根。
     *
     * @param projectRoot 含 settings.gradle、apps/host 和 apps/mda 的根，例如 JUnit 临时目录
     *     <p>构造完成后无返回值；路径会转换为绝对规范路径。
     */
    MdaProjectGeneratorServiceImpl(Path projectRoot) {
        this.projectRoot = projectRoot.toAbsolutePath().normalize();
    }

    /**
     * 首次创建完整工程，或在生成器拥有的既有工程中追加一张新业务表。
     *
     * @param request 页面提交的工程和表编码，例如 {@code {projectName:"japan",tableName:"region"}}
     * @return 生成结果，例如 {@code {projectCreated:true,pageUrl:"/japan/japan.html"}}
     * @throws CommonBusinessException 编码非法、工程不受管理或任一目标文件已存在时抛出
     * @throws CommonSystemException 文件准备或原子写入失败时抛出；副作用会回滚本次写入
     */
    @Override
    public synchronized MdaProjectGenerationData generate(CommonParam request) {
        MdaProjectNames names = normalize(request);
        Path projectDirectory = insideRoot(projectRoot.resolve("apps").resolve(names.projectCode()));
        boolean projectCreated = !Files.exists(projectDirectory);
        if (!projectCreated && !Files.isRegularFile(projectDirectory.resolve(OWNERSHIP_MARKER))) {
            throw new CommonBusinessException(
                    "MDA_PROJECT_NOT_GENERATOR_OWNED",
                    "工程目录已经存在且不是由创建工程功能生成，未执行任何写入：apps/" + names.projectCode());
        }
        GenerationPlan plan = buildPlan(names, projectDirectory, projectCreated);
        List<Path> collisions = plan.newFiles().keySet().stream().filter(Files::exists).toList();
        if (!collisions.isEmpty()) {
            String files = collisions.stream().map(this::relative).sorted()
                    .reduce((left, right) -> left + "、" + right).orElse("");
            throw new CommonBusinessException("MDA_PROJECT_FILE_EXISTS", "目标文件已存在，未执行创建：" + files);
        }
        applyPlan(plan);
        String pageCode = projectCreated ? names.projectCode() : names.tableCode();
        return new MdaProjectGenerationData(
                names.projectCode(),
                names.tableCode(),
                names.actualTableName(),
                projectCreated,
                "/" + names.projectCode() + "/" + pageCode + ".html",
                true,
                plan.newFiles().keySet().stream().map(this::relative).sorted().toList());
    }

    /**
     * 规范化并校验两个页面输入，建立全部派生命名。
     *
     * @param request 原始请求，例如 {@code {projectName:"japan",tableName:"region-type"}}
     * @return 命名集合，例如工程类名 {@code Japan}、表类名 {@code JapanRegionType}
     * @throws CommonBusinessException 任一输入不符合小写短横线规则时抛出
     */
    private MdaProjectNames normalize(CommonParam request) {
        String projectCode = cleanCode(commonText(request, "projectName"));
        String tableCode = cleanCode(commonText(request, "tableName"));
        if (!CODE_PATTERN.matcher(projectCode).matches()) {
            throw new CommonBusinessException(
                    "MDA_PROJECT_NAME_INVALID",
                    "工程名只能使用小写字母、数字和短横线，并且必须以字母开头，最长 32 位。");
        }
        if (!CODE_PATTERN.matcher(tableCode).matches()) {
            throw new CommonBusinessException(
                    "MDA_TABLE_NAME_INVALID",
                    "表名只能使用小写字母、数字和短横线，并且必须以字母开头，最长 32 位。");
        }
        String projectClass = pascal(projectCode);
        String tableClass = pascal(tableCode);
        return new MdaProjectNames(
                projectCode,
                tableCode,
                projectClass,
                tableClass,
                projectClass + tableClass,
                "com.sp.selplat." + projectCode.replace("-", ""));
    }

    /**
     * 从 SELPLAT 公共参数容器中读取一个 MDA 生成字段。
     * 真实传参示例：参数为 {@code {projectName:"japan"}}，字段名为 {@code projectName}。
     * 真实返回示例：返回 {@code "japan"}；字段缺失时返回空串。
     * 异常或副作用示例：请求为空时不抛出异常，不修改参数映射。
     *
     * @param request SELPLAT 公共单条请求参数
     * @param field 生成字段名
     * @return 字段的文本值
     */
    private String commonText(CommonParam request, String field) {
        Object value = request == null ? null : request.getParam(field);
        return value == null ? "" : String.valueOf(value);
    }

    /**
     * 去除输入首尾空格并统一为小写。
     *
     * @param value 页面原始值，例如 {@code " Japan "}
     * @return 规范编码，例如 {@code "japan"}；空值返回空串
     */
    private String cleanCode(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * 把短横线编码转换为 Java PascalCase 名称。
     *
     * @param code 已校验编码，例如 {@code "region-type"}
     * @return Java 名称，例如 {@code "RegionType"}
     */
    private String pascal(String code) {
        StringBuilder result = new StringBuilder();
        for (String part : code.split("-")) {
            result.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return result.toString();
    }

    /**
     * 准备完整新工程文件或既有工程新增表文件，并生成登记文件的新正文。
     *
     * @param names 已验证命名，例如 {@code japan/region/JapanRegion}
     * @param projectDirectory 目标工程目录，例如 {@code apps/japan}
     * @param projectCreated 是否首次创建完整工程
     * @return 包含新文件和允许更新文件的执行计划
     * <p>真实传参示例：首次生成 {@code japan/region} 时 {@code projectCreated=true}。
     * <p>真实返回示例：计划同时包含应用文件、Gradle、桌面入口和中央数据库应用登记。
     * <p>异常或副作用示例：中央登记缺失或结构无效时抛出异常，尚未写入任何文件。
     *
     * @throws CommonSystemException 根登记文件缺失或读取失败时抛出
     */
    private GenerationPlan buildPlan(
            MdaProjectNames names,
            Path projectDirectory,
            boolean projectCreated) {
        try {
            Map<Path, String> newFiles = new LinkedHashMap<>();
            Map<Path, String> changedFiles = new LinkedHashMap<>();
            if (projectCreated) {
                addRelativeFiles(newFiles, projectDirectory, MdaProjectTemplateCatalog.projectFiles(names));
                changedFiles.put(projectRoot.resolve("settings.gradle"), registerSettings(names));
                changedFiles.put(
                        projectRoot.resolve("apps/host/backend/build.gradle"),
                        registerHostDependency(names));
                changedFiles.put(
                        projectRoot.resolve("apps/host/backend/src/main/resources/static/desktop/applications.json"),
                        registerDesktopApplication(names));
                changedFiles.put(
                        projectRoot.resolve("apps/host/backend/src/main/resources/static/desktop/desktop.js"),
                        registerDesktopAllowedPath(names));
                changedFiles.put(
                        managedDatabaseRegistryPath(),
                        registerManagedDatabaseApplication(names));
            }
            String pageCode = projectCreated ? names.projectCode() : names.tableCode();
            addRelativeFiles(
                    newFiles,
                    projectDirectory,
                    MdaProjectTemplateCatalog.tableFiles(names, pageCode));
            if (!projectCreated) {
                addExistingProjectUpdates(changedFiles, projectDirectory, names);
            }
            return new GenerationPlan(newFiles, changedFiles);
        } catch (IOException exception) {
            throw new CommonSystemException(
                    "MDA_PROJECT_PLAN_FAILED",
                    "创建工程文件计划准备失败。",
                    exception);
        }
    }

    /**
     * 把模板目录中的相对文件统一登记到受控新文件计划。
     *
     * @param target 待创建文件集合
     * @param projectDirectory 目标工程根，例如 {@code apps/japan}
     * @param relativeFiles 模板返回的相对路径和完整正文
     *     <p>执行完成后无返回值；所有路径都会经过工程根边界校验。
     */
    private void addRelativeFiles(
            Map<Path, String> target,
            Path projectDirectory,
            Map<String, String> relativeFiles) {
        relativeFiles.forEach((path, content) ->
                target.put(insideRoot(projectDirectory.resolve(path)), content));
    }

    /**
     * 为既有生成工程追加 SQL 顺序、号段和表登记。
     *
     * @param changedFiles 允许更新的登记文件集合
     * @param projectDirectory 已验证生成器拥有的工程目录
     * @param names 新业务表命名，例如 {@code JapanCity}
     *     <p>执行完成后无返回值；业务表源码和页面仍只进入新文件计划。
     * @throws IOException 任一必要登记文件缺失时抛出
     */
    private void addExistingProjectUpdates(
            Map<Path, String> changedFiles,
            Path projectDirectory,
            MdaProjectNames names) throws IOException {
        Path loadOrder = projectDirectory.resolve("backend/src/main/resources/db")
                .resolve(names.projectCode()).resolve("sql/load-order.txt");
        String commonData = "db/" + names.projectCode()
                + "/sql/data-CommonSequenceSegment.sql";
        String firstBusinessDataPrefix = "db/" + names.projectCode() + "/sql/data-";
        String order = insertBeforePrefix(
                readRequired(loadOrder),
                firstBusinessDataPrefix,
                "db/" + names.projectCode() + "/sql/schema-"
                        + names.actualTableName() + ".sql");
        order = insertBeforePrefix(
                order,
                commonData,
                "db/" + names.projectCode() + "/sql/data-"
                        + names.actualTableName() + ".sql");
        changedFiles.put(loadOrder, order);

        Path sequenceData = projectDirectory.resolve("db/sql/data-CommonSequenceSegment.sql");
        changedFiles.put(
                sequenceData,
                appendLine(readRequired(sequenceData), MdaProjectTemplateCatalog.sequenceSeed(names)));

        Path tableRegistry = projectDirectory.resolve(
                "backend/src/main/resources/META-INF/selplat-project-tables.list");
        changedFiles.put(
                tableRegistry,
                appendLine(
                        readRequired(tableRegistry),
                        names.tableCode() + "=" + names.actualTableName()));
    }

    /**
     * 原子执行全部新建和登记文件更新，并在失败时恢复原正文。
     *
     * @param plan 已通过冲突预检的执行计划
     *     <p>执行成功无返回值；失败会删除本轮新文件并恢复被更新文件。
     * @throws CommonSystemException 任一写入失败时抛出
     */
    private void applyPlan(GenerationPlan plan) {
        Map<Path, byte[]> originalChanged = new LinkedHashMap<>();
        List<Path> writtenNew = new ArrayList<>();
        try {
            for (Path target : plan.changedFiles().keySet()) {
                originalChanged.put(target, Files.readAllBytes(target));
            }
            for (Map.Entry<Path, String> entry : plan.newFiles().entrySet()) {
                atomicWrite(entry.getKey(), entry.getValue());
                writtenNew.add(entry.getKey());
            }
            for (Map.Entry<Path, String> entry : plan.changedFiles().entrySet()) {
                atomicWrite(entry.getKey(), entry.getValue());
            }
        } catch (Exception exception) {
            rollback(writtenNew, originalChanged);
            throw new CommonSystemException(
                    "MDA_PROJECT_WRITE_FAILED",
                    "工程创建失败，已回滚本次文件写入。",
                    exception);
        }
    }

    /**
     * 使用同目录临时文件替换目标，避免写到一半留下截断文件。
     *
     * @param target 受控目标，例如 {@code apps/japan/backend/build.gradle}
     * @param content 完整 UTF-8 正文
     *     <p>执行完成后无返回值；副作用是创建父目录并替换目标。
     * @throws IOException 创建目录、写临时文件或移动失败时抛出
     */
    private void atomicWrite(Path target, String content) throws IOException {
        Path safeTarget = insideRoot(target);
        Files.createDirectories(safeTarget.getParent());
        Path temporary = Files.createTempFile(safeTarget.getParent(), ".selplat-generator-", ".tmp");
        try {
            Files.writeString(
                    temporary,
                    content.endsWith("\n") ? content : content + "\n",
                    StandardCharsets.UTF_8);
            try {
                Files.move(
                        temporary,
                        safeTarget,
                        StandardCopyOption.ATOMIC_MOVE,
                        StandardCopyOption.REPLACE_EXISTING);
            } catch (java.nio.file.AtomicMoveNotSupportedException exception) {
                Files.move(temporary, safeTarget, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    /**
     * 恢复更新文件并清理本轮新建文件和空目录。
     *
     * @param writtenNew 已成功落盘的新文件
     * @param originals 更新文件的原始字节
     *     <p>执行完成后无返回值；回滚自身失败不会掩盖最初的生成异常。
     */
    private void rollback(List<Path> writtenNew, Map<Path, byte[]> originals) {
        originals.forEach((path, bytes) -> {
            try {
                Files.write(path, bytes);
            } catch (IOException ignored) {
                // 原始生成异常仍是对外根因；无法恢复的路径由服务端堆栈保留排查。
            }
        });
        writtenNew.stream().sorted(Comparator.reverseOrder()).forEach(path -> {
            try {
                Files.deleteIfExists(path);
            } catch (IOException ignored) {
                // 只清理本轮明确记录的新文件，不扩大到用户既有目录。
            }
        });
        Path appsRoot = projectRoot.resolve("apps");
        writtenNew.stream()
                .map(Path::getParent)
                .distinct()
                .sorted(Comparator.reverseOrder())
                .forEach(directory -> deleteEmptyParents(directory, appsRoot));
    }

    /**
     * 从给定目录向上删除本轮产生的空目录，但绝不删除 apps 根。
     *
     * @param directory 新文件原父目录
     * @param stopDirectory 固定停止目录，例如 {@code SELPLAT/apps}
     *     <p>执行完成后无返回值；遇到非空目录或删除失败时立即停止。
     */
    private void deleteEmptyParents(Path directory, Path stopDirectory) {
        Path current = directory;
        while (current != null && current.startsWith(stopDirectory) && !current.equals(stopDirectory)) {
            try (Stream<Path> children = Files.list(current)) {
                if (children.findAny().isPresent()) return;
            } catch (IOException exception) {
                return;
            }
            try {
                Files.deleteIfExists(current);
            } catch (IOException exception) {
                return;
            }
            current = current.getParent();
        }
    }

    /**
     * 在 settings.gradle 的固定生成区登记模块和物理目录。
     *
     * @param names 工程命名，例如 {@code japan/Japan}
     * @return 更新后的完整 settings.gradle 正文
     * @throws IOException settings.gradle 缺失或读取失败时抛出
     */
    private String registerSettings(MdaProjectNames names) throws IOException {
        String text = readRequired(projectRoot.resolve("settings.gradle"));
        String declaration = "include('apps:" + names.projectCode() + ":backend')\n"
                + "project(':apps:" + names.projectCode() + ":backend').projectDir = file('apps/"
                + names.projectCode() + "/backend')";
        return text.contains(declaration)
                ? text
                : appendRegistration(text, SETTINGS_ANCHOR, declaration);
    }

    /**
     * 在 Host dependencies 的固定生成区登记新模块实现依赖。
     *
     * @param names 工程命名，例如 {@code japan/Japan}
     * @return 更新后的完整 Host build.gradle 正文
     * @throws IOException Host 构建文件缺失或登记锚点失效时抛出
     */
    private String registerHostDependency(MdaProjectNames names) throws IOException {
        String text = readRequired(projectRoot.resolve("apps/host/backend/build.gradle"));
        String declaration = "    implementation project(':apps:"
                + names.projectCode() + ":backend')";
        if (text.contains(declaration)) return text;
        if (!text.contains(HOST_ANCHOR)) {
            String mdaDependency = "    implementation project(':apps:mda:backend')";
            if (!text.contains(mdaDependency)) throw new IOException("Host 依赖登记锚点不存在");
            text = text.replace(mdaDependency, mdaDependency + "\n" + HOST_ANCHOR);
        }
        return text.replace(HOST_ANCHOR, HOST_ANCHOR + "\n" + declaration);
    }

    /**
     * 在 Host 桌面清单登记新应用入口。
     * 真实传参示例：工程 {@code japan} 生成 {@code /japan/japan.html} 入口。
     * 真实返回示例：applications 数组新增 code 为 {@code japan} 的完整应用对象。
     * 异常或副作用示例：清单结构失效时抛出 IOException，生成事务回滚全部新文件和登记。
     *
     * @param names 已验证工程命名
     * @return 包含唯一应用入口的完整 JSON 正文
     * @throws IOException 桌面清单缺失或结构无法识别时抛出
     */
    private String registerDesktopApplication(MdaProjectNames names) throws IOException {
        Path path = projectRoot.resolve(
                "apps/host/backend/src/main/resources/static/desktop/applications.json");
        String text = readRequired(path);
        if (text.contains("\"code\": \"" + names.projectCode() + "\"")) return text;
        int arrayEnd = text.lastIndexOf("\n  ]");
        if (arrayEnd < 0) throw new IOException("Host 桌面应用清单结构无效");
        String before = text.substring(0, arrayEnd).stripTrailing();
        String separator = before.endsWith("[") ? "\n" : ",\n";
        String entry = """
                    {
                      \"code\": \"@PROJECT@\",
                      \"name\": \"@PROJECT_CLASS@\",
                      \"shortName\": \"@PROJECT_CLASS@\",
                      \"description\": \"管理 @PROJECT_CLASS@ 业务数据\",
                      \"icon\": \"ri-apps-2-line\",
                      \"tone\": \"blue\",
                      \"url\": \"/@PROJECT@/@PROJECT@.html\",
                      \"openMode\": \"new-tab\",
                      \"permissionCode\": \"@PROJECT@:access\",
                      \"visible\": true,
                      \"enabled\": true,
                      \"sortnum\": 100
                    }"""
                .replace("@PROJECT@", names.projectCode())
                .replace("@PROJECT_CLASS@", names.projectClass());
        return before + separator + entry + text.substring(arrayEnd);
    }

    /**
     * 把新应用根路径加入桌面同源内部跳转白名单。
     * 真实传参示例：工程 {@code japan} 登记 {@code /japan/}。
     * 真实返回示例：desktop.js 的固定锚点后包含唯一路径字符串。
     * 异常或副作用示例：锚点缺失时抛出 IOException，禁止生成无法点击的桌面入口。
     *
     * @param names 已验证工程命名
     * @return 包含新内部路径的完整 desktop.js
     * @throws IOException desktop.js 缺失或登记锚点失效时抛出
     */
    private String registerDesktopAllowedPath(MdaProjectNames names) throws IOException {
        Path path = projectRoot.resolve(
                "apps/host/backend/src/main/resources/static/desktop/desktop.js");
        String text = readRequired(path);
        String declaration = "        \"/" + names.projectCode() + "/\",";
        if (text.contains("\"/" + names.projectCode() + "/\"")) return text;
        if (!text.contains(DESKTOP_PATH_ANCHOR)) {
            throw new IOException("Host 桌面内部路径登记锚点不存在");
        }
        return text.replace(
                DESKTOP_PATH_ANCHOR,
                DESKTOP_PATH_ANCHOR + "\n" + declaration);
    }

    /**
     * 把新工程写入当前用户的中央数据库应用登记，门禁不再依赖应用内隐藏文件。
     * 真实传参示例：工程 {@code japan} 登记数据库 {@code db/japan.mv.db}。
     * 真实返回示例：中央 applications 数组新增一条 {@code table-business-only} 记录。
     * 异常或副作用示例：版本、数组或重复工程无效时抛出 IOException，生成事务不落盘。
     *
     * @param names 已验证工程命名
     * @return 更新后的中央登记完整 JSON
     * @throws IOException 中央登记缺失、格式无效或工程重复时抛出
     */
    private String registerManagedDatabaseApplication(MdaProjectNames names) throws IOException {
        Path registryPath = managedDatabaseRegistryPath();
        JsonNode document = JSON.readTree(readRequired(registryPath));
        if (!(document instanceof ObjectNode root)
                || root.path("version").asInt(-1) != 1
                || !(root.get("applications") instanceof ArrayNode applications)) {
            throw new IOException("数据库应用中央登记结构无效");
        }
        for (JsonNode application : applications) {
            if (names.projectCode().equals(application.path("projectName").asText())) {
                throw new IOException("数据库应用中央登记已存在工程：" + names.projectCode());
            }
        }
        ObjectNode application = applications.addObject();
        application.put("projectName", names.projectCode());
        application.put("structure", "table-business-only");
        application.put("schemaRoot", "db/sql");
        application.put("databaseFile", "db/" + names.projectCode() + ".mv.db");
        application.put("primaryKeyStrategy", "one-table-one-sequence");
        application.put("datasourcePrefix", names.projectCode() + ".datasource");
        return JSON.writerWithDefaultPrettyPrinter().writeValueAsString(root);
    }

    /**
     * 根据根 AGENTS.md 的当前稳定用户定位唯一中央数据库应用登记。
     * 真实传参示例：声明 {@code 当前稳定用户 ID：XUNAN} 时定位其 SELPLAT 通用 registry。
     * 真实返回示例：返回 rule-engine 当前用户层的 managed-database-applications.json。
     * 异常或副作用示例：用户声明缺失、重复或不安全时抛出 IOException，不创建目录。
     *
     * @return 位于当前 SELPLAT 根内的中央登记绝对路径
     * @throws IOException AGENTS.md 用户声明不唯一或不安全时抛出
     */
    private Path managedDatabaseRegistryPath() throws IOException {
        String agents = readRequired(projectRoot.resolve("AGENTS.md"));
        Matcher matcher = STABLE_USER_PATTERN.matcher(agents);
        if (!matcher.find()) throw new IOException("AGENTS.md 缺少当前稳定用户 ID");
        String stableUserId = matcher.group(1).trim();
        if (!stableUserId.matches("[A-Za-z][A-Za-z0-9_-]{0,63}") || matcher.find()) {
            throw new IOException("AGENTS.md 当前稳定用户 ID 不唯一或不安全");
        }
        return insideRoot(projectRoot.resolve(
                "apps/rule-engine/backend/src/main/resources/local/"
                        + stableUserId
                        + "/selplat/通用/registry/managed-database-applications.json"));
    }

    /**
     * 向已有固定锚点后追加登记；锚点不存在时创建在文末。
     *
     * @param text 原文件完整正文
     * @param anchor 稳定注释，例如 {@code // SELPLAT-GENERATED-MODULES}
     * @param declaration 待追加登记正文
     * @return 保留原正文并包含新登记的完整文本
     */
    private String appendRegistration(String text, String anchor, String declaration) {
        if (!text.contains(anchor)) {
            return text.stripTrailing() + "\n\n" + anchor + "\n" + declaration + "\n";
        }
        return text.replace(anchor, anchor + "\n" + declaration);
    }

    /**
     * 把新行追加到 UTF-8 登记文件，重复内容保持幂等。
     *
     * @param text 原正文
     * @param line 新行，例如 {@code region=JapanRegion}
     * @return 包含唯一新行的正文
     */
    private String appendLine(String text, String line) {
        return text.lines().anyMatch(line::equals)
                ? text
                : text.stripTrailing() + "\n" + line + "\n";
    }

    /**
     * 在第一个匹配前缀的加载项前插入唯一新行，保持结构脚本先于数据脚本。
     *
     * @param text 原加载清单
     * @param prefix 插入锚点前缀，例如 {@code db/japan/sql/data-}
     * @param line 新资源路径，例如 {@code db/japan/sql/schema-JapanCity.sql}
     * @return 包含唯一新行且保持原有顺序的完整清单
     */
    private String insertBeforePrefix(String text, String prefix, String line) {
        if (text.lines().anyMatch(line::equals)) return text;
        List<String> lines = new ArrayList<>(text.lines().toList());
        int insertionIndex = 0;
        while (insertionIndex < lines.size()
                && !lines.get(insertionIndex).startsWith(prefix)) {
            insertionIndex++;
        }
        lines.add(insertionIndex, line);
        return String.join("\n", lines) + "\n";
    }

    /**
     * 读取必须存在的 UTF-8 文件。
     *
     * @param path 工程内文件，例如 {@code settings.gradle}
     * @return 文件完整正文
     * @throws IOException 文件不存在或无法读取时抛出
     */
    private String readRequired(Path path) throws IOException {
        return Files.readString(insideRoot(path), StandardCharsets.UTF_8);
    }

    /**
     * 确保所有目标始终位于当前 SELPLAT 根内。
     *
     * @param path 待验证路径，例如 {@code root/apps/japan}
     * @return 绝对规范安全路径
     * @throws CommonBusinessException 路径逃逸当前工程根时抛出
     */
    private Path insideRoot(Path path) {
        Path normalized = path.toAbsolutePath().normalize();
        if (!normalized.startsWith(projectRoot)) {
            throw new CommonBusinessException(
                    "MDA_PROJECT_PATH_ESCAPE",
                    "生成路径超出 SELPLAT 工程根，已拒绝执行。");
        }
        return normalized;
    }

    /**
     * 把绝对目标转换为用户可定位的工程相对路径。
     *
     * @param path 工程内绝对路径
     * @return 使用正斜线的相对路径，例如 {@code apps/japan/README.md}
     */
    private String relative(Path path) {
        return projectRoot.relativize(path.toAbsolutePath().normalize())
                .toString().replace('\\', '/');
    }

    /**
     * 从任意子目录向上定位 SELPLAT 根。
     *
     * @param startPath 当前 Java 进程工作目录
     * @return 同时包含 settings.gradle 和 apps/mda 的根
     * @throws CommonSystemException 没有找到工程根时抛出
     */
    private static Path locateProjectRoot(Path startPath) {
        Path current = startPath.toAbsolutePath().normalize();
        while (current != null) {
            if (Files.isRegularFile(current.resolve("settings.gradle"))
                    && Files.isDirectory(current.resolve("apps/mda"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new CommonSystemException(
                "MDA_PROJECT_ROOT_NOT_FOUND",
                "无法定位 SELPLAT 工程根。",
                null);
    }

    /** 区分必须不存在的新文件与允许按固定规则更新的登记文件。 */
    private record GenerationPlan(
            Map<Path, String> newFiles,
            Map<Path, String> changedFiles) {
    }
}
