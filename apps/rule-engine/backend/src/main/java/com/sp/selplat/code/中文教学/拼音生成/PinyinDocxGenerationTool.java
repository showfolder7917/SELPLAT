package com.sp.selplat.code.中文教学.拼音生成;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

/**
 * 从普通中文 DOCX 生成“拼音在上、原文在下”可编辑 DOCX 的通用命令行工具。
 */
public final class PinyinDocxGenerationTool {

    private static final Logger LOGGER = Logger.getLogger(PinyinDocxGenerationTool.class.getName());

    /**
     * 工具类不需要创建实例。
     */
    private PinyinDocxGenerationTool() {
        // 业务上只允许通过 main 或 generate 调用，避免无状态工具被误当作可变服务保存。
    }

    /**
     * 命令行入口。
     *
     * @param args `--source`、`--target`、`--dictionary`、`--overwrite` 和 `--dry-run` 参数
     * @throws Exception 输入校验、注音或文档生成失败
     */
    public static void main(String[] args) throws Exception {
        // 业务上统一解析键值参数，让同一工具可以由 Gradle、IDE 或批处理脚本调用。
        Map<String, String> arguments = parseArguments(args);
        Path sourcePath = requiredPath(arguments, "source");
        Path targetPath = requiredPath(arguments, "target");
        Path dictionaryPath = optionalPath(arguments, "dictionary");
        boolean overwrite = Boolean.parseBoolean(arguments.getOrDefault("overwrite", "false"));
        boolean dryRun = Boolean.parseBoolean(arguments.getOrDefault("dry-run", "false"));
        String mode = arguments.getOrDefault("mode", "paragraph");
        // 业务上命令行和代码调用共享同一生成方法，避免正式工具与测试使用不同处理链。
        GenerationSummary summary = generate(sourcePath, targetPath, dictionaryPath, overwrite, dryRun, mode);
        LOGGER.info(() -> "拼音文档处理完成 paragraphs=" + summary.paragraphCount()
            + ", hanzi=" + summary.hanziCount() + ", dryRun=" + dryRun + ", target=" + summary.targetPath());
    }

    /**
     * 执行一次通用拼音文档生成。
     *
     * @param sourcePath 普通 DOCX 源文件
     * @param targetPath 输出 DOCX 文件
     * @param dictionaryPath 可选的 UTF-8 TSV 纠音词典
     * @param overwrite 是否覆盖已有目标
     * @param dryRun 是否只解析和注音而不写文件
     * @return 生成统计
     * @throws IOException 文件读写失败
     * @throws NoSuchAlgorithmException 当前 JVM 不支持 SHA-256
     * @throws IllegalStateException 生成过程中源文件发生变化
     */
    public static GenerationSummary generate(
        Path sourcePath,
        Path targetPath,
        Path dictionaryPath,
        boolean overwrite,
        boolean dryRun
    ) throws IOException, NoSuchAlgorithmException {
        // 业务上保留原有方法签名并默认使用普通段落模式，避免已有三字经调用方受诗词扩展影响。
        return generate(sourcePath, targetPath, dictionaryPath, overwrite, dryRun, "paragraph");
    }

    /**
     * 按指定内容模式执行拼音文档生成。
     *
     * @param sourcePath 普通 DOCX 源文件
     * @param targetPath 输出 DOCX 文件
     * @param dictionaryPath 可选纠音词典
     * @param overwrite 是否覆盖目标
     * @param dryRun 是否只校验不写文件
     * @param mode `paragraph` 普通段落、`poetry` 教材诗词或 `classical` 文言文模式
     * @return 生成统计
     * @throws IOException 文件读写失败
     * @throws NoSuchAlgorithmException 当前 JVM 不支持 SHA-256
     * @throws IllegalStateException 生成过程中源文件发生变化
     */
    public static GenerationSummary generate(
        Path sourcePath,
        Path targetPath,
        Path dictionaryPath,
        boolean overwrite,
        boolean dryRun,
        String mode
    ) throws IOException, NoSuchAlgorithmException {
        // 业务上先规范化绝对路径，避免相对路径别名绕过源目标相同文件检查。
        Path normalizedSource = sourcePath.toAbsolutePath().normalize();
        Path normalizedTarget = targetPath.toAbsolutePath().normalize();
        validatePaths(normalizedSource, normalizedTarget, dictionaryPath);
        // 业务上记录源文件哈希，生成后必须保持一致，保证工具只读原版文档。
        String sourceHashBefore = sha256(normalizedSource);
        // 业务上纠音词典可选，使通用工具能生成样稿；正式古文交付应显式提供专用词典。
        Map<String, List<String>> overrides = dictionaryPath == null
            ? Map.of()
            : PinyinTextConverter.loadOverrides(dictionaryPath.toAbsolutePath().normalize());
        PinyinTextConverter converter = new PinyinTextConverter(overrides);
        int itemCount;
        int hanziCount;
        if ("poetry".equals(mode) || "classical".equals(mode)) {
            // 业务上诗词模式先清除目录和分册信息，再以标题、朝代、作者和正文结构生成一诗一页。
            List<PoetryDocumentParser.Poem> poems;
            if ("classical".equals(mode)) {
                // 业务上文言文先按篇解析，再把长段拆成最多 16 字的阅读行，使一篇可自然延续多页。
                poems = ClassicalChineseDocumentParser.parse(normalizedSource).stream()
                    .map(ClassicalChineseDocumentParser.Article::toRenderableWork)
                    .toList();
            } else {
                // 业务上古诗词保持现有解析方式，不受长篇文言文启发式规则影响。
                poems = PoetryDocumentParser.parse(normalizedSource);
            }
            itemCount = poems.size();
            if (dryRun) {
                // 业务上诗词 dry-run 覆盖标题、朝代作者和正文，完整验证纠音词典而不写目标文件。
                hanziCount = poems.stream()
                    .flatMap(poem -> {
                        List<String> fields = new ArrayList<>();
                        fields.add(poem.title());
                        fields.add(poem.attribution());
                        fields.addAll(poem.lines().stream().filter(line -> !line.isBlank()).toList());
                        return fields.stream();
                    })
                    .map(converter::convert)
                    .mapToInt(PinyinDocxGenerationTool::countHanzi)
                    .sum();
            } else {
                // 业务上正式诗词输出使用独立渲染器，硬分页确保每首诗恰好从新页开始。
                PoetryDocxRenderer renderer = new PoetryDocxRenderer(PinyinGenerationConfig.daodejingStyle());
                PoetryDocxRenderer.GenerationResult result = renderer.render(poems, normalizedTarget, converter, overwrite);
                hanziCount = result.hanziCount();
            }
        } else {
            // 业务上普通段落模式保持原有标题加连续正文的处理方式，继续服务三字经等材料。
            List<String> paragraphs = readNonEmptyParagraphs(normalizedSource);
            itemCount = paragraphs.size();
            if (dryRun) {
                // 业务上 dry-run 仍执行全文注音和对齐检查，只跳过 DOCX 写入。
                hanziCount = paragraphs.stream()
                    .map(converter::convert)
                    .mapToInt(PinyinDocxGenerationTool::countHanzi)
                    .sum();
            } else {
                // 业务上正式普通文档继续使用已验证的道德经式版式配置。
                PinyinDocxRenderer renderer = new PinyinDocxRenderer(PinyinGenerationConfig.daodejingStyle());
                PinyinDocxRenderer.GenerationResult result = renderer.render(
                    paragraphs,
                    normalizedTarget,
                    converter,
                    overwrite
                );
                hanziCount = result.hanziCount();
            }
        }
        // 业务上生成前后重新计算源文件哈希，任何变化都视为严重保护失败。
        String sourceHashAfter = sha256(normalizedSource);
        if (!sourceHashBefore.equals(sourceHashAfter)) {
            throw new IllegalStateException("源文件在生成过程中发生变化: " + normalizedSource);
        }
        // 业务上 dry-run 仍返回预期目标路径，便于调用脚本记录将来的正式输出位置。
        return new GenerationSummary(itemCount, hanziCount, normalizedTarget, sourceHashAfter);
    }

    /**
     * 统计转换结果中的汉字单元。
     *
     * @param cells 一段文本的注音单元
     * @return 已注音汉字数
     */
    private static int countHanzi(List<PinyinTextConverter.PinyinCell> cells) {
        // 业务上只统计真正需要拼音的汉字，标点和空格不计入完成量。
        return (int) cells.stream()
            .filter(cell -> cell.type() == PinyinTextConverter.CellType.HANZI)
            .count();
    }

    /**
     * 读取 DOCX 中按顺序排列的非空段落。
     *
     * @param sourcePath 源 DOCX
     * @return 标题和正文段落
     * @throws IOException DOCX 读取失败
     * @throws IllegalArgumentException 源文档中没有可生成的非空段落
     */
    static List<String> readNonEmptyParagraphs(Path sourcePath) throws IOException {
        // 业务上只提取段落文本，不改变源文件中的任何 OOXML 部件。
        List<String> paragraphs = new ArrayList<>();
        try (InputStream inputStream = Files.newInputStream(sourcePath);
             XWPFDocument document = new XWPFDocument(inputStream)) {
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                // 业务上保留段落内部空格，只过滤整段为空的结构性段落。
                String text = paragraph.getText();
                if (text != null && !text.isBlank()) {
                    paragraphs.add(text);
                }
            }
        }
        // 业务上空文档不能生成注音版，避免输出一个看似成功的空 DOCX。
        if (paragraphs.isEmpty()) {
            throw new IllegalArgumentException("源 DOCX 没有非空段落: " + sourcePath);
        }
        // 业务上返回不可变段落序列，确保后续转换和渲染不能重排源文档。
        return List.copyOf(paragraphs);
    }

    /**
     * 校验源、目标和纠音词典路径。
     *
     * @param sourcePath 规范化源路径
     * @param targetPath 规范化目标路径
     * @param dictionaryPath 可选词典路径
     * @throws IllegalArgumentException 文件类型、可读性或源目标隔离不符合生成约束
     */
    private static void validatePaths(Path sourcePath, Path targetPath, Path dictionaryPath) {
        // 业务上源文件必须真实存在且可读取，否则不能启动任何输出动作。
        if (!Files.isRegularFile(sourcePath) || !Files.isReadable(sourcePath)) {
            throw new IllegalArgumentException("源 DOCX 不存在或不可读: " + sourcePath);
        }
        // 业务上通用生成器只接受 DOCX，旧 DOC 仅作为视觉参考，不能进入不稳定的转换链。
        if (!sourcePath.getFileName().toString().toLowerCase().endsWith(".docx")) {
            throw new IllegalArgumentException("源文件必须是 DOCX: " + sourcePath);
        }
        if (!targetPath.getFileName().toString().toLowerCase().endsWith(".docx")) {
            throw new IllegalArgumentException("目标文件必须是 DOCX: " + targetPath);
        }
        // 业务上绝不允许源目标为同一路径，覆盖参数也不能绕过原版保护。
        if (sourcePath.equals(targetPath)) {
            throw new IllegalArgumentException("目标文件不能与源文件相同: " + sourcePath);
        }
        // 业务上用户显式提供词典时必须确保其可读，避免无提示退回默认多音字结果。
        if (dictionaryPath != null) {
            Path normalizedDictionary = dictionaryPath.toAbsolutePath().normalize();
            if (!Files.isRegularFile(normalizedDictionary) || !Files.isReadable(normalizedDictionary)) {
                throw new IllegalArgumentException("纠音词典不存在或不可读: " + normalizedDictionary);
            }
        }
    }

    /**
     * 解析 `--key value` 命令行参数。
     *
     * @param args 原始命令行参数
     * @return 参数名到参数值的映射
     * @throws IllegalArgumentException 参数不成对、重复或包含不支持的选项
     */
    private static Map<String, String> parseArguments(String[] args) {
        // 业务上使用有序映射保留输入顺序，重复参数可以立即给出稳定错误。
        Map<String, String> arguments = new LinkedHashMap<>();
        for (int index = 0; index < args.length; index += 2) {
            // 业务上每个参数必须同时存在名称和值，禁止把缺失值误判成下一项开关。
            if (index + 1 >= args.length || !args[index].startsWith("--")) {
                throw new IllegalArgumentException("参数必须使用 --key value 成对提供");
            }
            String key = args[index].substring(2);
            if (arguments.putIfAbsent(key, args[index + 1]) != null) {
                throw new IllegalArgumentException("参数重复: --" + key);
            }
        }
        // 业务上拒绝未知参数，避免拼写错误导致工具使用默认值生成错误文档。
        List<String> supportedKeys = List.of("source", "target", "dictionary", "overwrite", "dry-run", "layout", "mode");
        arguments.keySet().stream()
            .filter(key -> !supportedKeys.contains(key))
            .findFirst()
            .ifPresent(key -> {
                throw new IllegalArgumentException("不支持的参数: --" + key);
            });
        // 业务上当前只提供经过验证的道德经式版式，提前拒绝不存在的配置名。
        String layout = arguments.getOrDefault("layout", "daodejing");
        if (!"daodejing".equals(layout)) {
            throw new IllegalArgumentException("当前仅支持 --layout daodejing");
        }
        // 业务上显式限制模式名称，避免拼写错误时静默退回普通段落生成错误版式。
        String mode = arguments.getOrDefault("mode", "paragraph");
        if (!List.of("paragraph", "poetry", "classical").contains(mode)) {
            throw new IllegalArgumentException("当前仅支持 --mode paragraph、--mode poetry 或 --mode classical");
        }
        return arguments;
    }

    /**
     * 读取必填路径参数。
     *
     * @param arguments 参数映射
     * @param key 参数名
     * @return 参数路径
     * @throws IllegalArgumentException 必填路径参数缺失或为空
     */
    private static Path requiredPath(Map<String, String> arguments, String key) {
        // 业务上必填路径缺失时立即终止，避免在当前工作目录生成意外文件。
        String value = arguments.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("缺少必填参数 --" + key);
        }
        return Paths.get(value);
    }

    /**
     * 读取可选路径参数。
     *
     * @param arguments 参数映射
     * @param key 参数名
     * @return 参数路径，未提供时为 null
     */
    private static Path optionalPath(Map<String, String> arguments, String key) {
        // 业务上没有专用词典时返回 null，让调用链明确区分“未提供”和“空路径”。
        String value = arguments.get(key);
        return value == null || value.isBlank() ? null : Paths.get(value);
    }

    /**
     * 计算文件 SHA-256。
     *
     * @param path 文件路径
     * @return 小写十六进制哈希
     * @throws IOException 文件读取失败
     * @throws NoSuchAlgorithmException JVM 不支持 SHA-256
     */
    private static String sha256(Path path) throws IOException, NoSuchAlgorithmException {
        // 业务上使用标准 SHA-256 对原版文件做前后比对，不依赖文件时间戳这种易变化元数据。
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream inputStream = Files.newInputStream(path)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) >= 0) {
                // 业务上只把真实读取的字节计入摘要，直到完整消费源文件。
                if (bytesRead > 0) {
                    digest.update(buffer, 0, bytesRead);
                }
            }
        }
        // 业务上固定输出两位小写十六进制，便于执行记录和后续人工复核。
        StringBuilder hash = new StringBuilder();
        for (byte value : digest.digest()) {
            hash.append(String.format("%02x", value));
        }
        return hash.toString();
    }

    /**
     * 通用生成任务统计。
     *
     * @param paragraphCount 非空段落数
     * @param hanziCount 已注音汉字数
     * @param targetPath 预期或实际目标路径
     * @param sourceSha256 未改变的源文件哈希
     */
    public record GenerationSummary(int paragraphCount, int hanziCount, Path targetPath, String sourceSha256) {
    }
}
