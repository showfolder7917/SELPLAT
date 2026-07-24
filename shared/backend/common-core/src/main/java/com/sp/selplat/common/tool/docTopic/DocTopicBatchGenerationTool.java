package com.sp.selplat.common.tool.docTopic;

import com.sp.selplat.common.tool.docTopic.DocTopicContentRepository.TopicContent;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Logger;

/**
 * 批量读取核定版拼音 DOCX，并按源文件独立目录生成古诗故事教学图片。
 */
public final class DocTopicBatchGenerationTool {

    // 业务上使用 JDK 日志记录批处理文件、篇目和输出路径，不在正式工具中扩散 System.out。
    private static final Logger LOGGER = Logger.getLogger(DocTopicBatchGenerationTool.class.getName());

    /**
     * 工具入口类不创建实例，防止参数和批处理状态跨任务残留。
     */
    private DocTopicBatchGenerationTool() {
        // 业务调用统一使用 main 或 generate，保证参数校验和源文件保护完整执行。
    }

    /**
     * 命令行入口。
     *
     * @param args 输入、输出、故事数据和覆盖策略
     * @throws Exception 参数、解析、渲染或写出失败
     */
    public static void main(String[] args) throws Exception {
        // 业务上先把 CLI 参数转换为确定配置，未知参数不能静默忽略。
        GenerationRequest request = parseArguments(args);
        // 业务上生成完成后记录结构化摘要，方便批量任务定位每个源文件的产出数量。
        GenerationSummary summary = generate(request);
        LOGGER.info(() -> "DOCX 故事图片生成完成 sources=" + summary.sourceCount()
            + ", images=" + summary.imageCount()
            + ", outputRoot=" + summary.outputRoot());
    }

    /**
     * 执行单文件或目录批处理。
     *
     * @param request 已校验前的生成请求
     * @return 生成统计
     * @throws IOException 文件读取或图片写出失败
     */
    public static GenerationSummary generate(GenerationRequest request) throws IOException {
        // 业务上生成入口再次校验记录对象，测试和其它 Java 调用不能绕过 CLI 约束。
        validateRequest(request);
        List<Path> sources = collectSources(request);
        // 业务上故事内容一次加载后复用于全部源文件，防止处理过程中 JSON 被修改导致前后不一致。
        DocTopicContentRepository repository = DocTopicContentRepository.load(request.topicData());
        int imageCount = 0;
        for (Path source : sources) {
            // 业务上生成前记录源文件哈希，最终确认工具只读原版。
            String sourceHashBefore = sha256(source);
            List<DocTopicPoem> poems = PinyinPoetryDocxParser.parse(source);
            int maximumPoems = request.limit() <= 0 ? poems.size() : Math.min(request.limit(), poems.size());
            // 业务上每个源文件使用自己的同名输出目录，同名篇目不会跨文件互相覆盖。
            Path sourceOutputDirectory = request.outputRoot().resolve(baseName(source.getFileName().toString()));
            for (int poemIndex = 0; poemIndex < maximumPoems; poemIndex++) {
                DocTopicPoem poem = poems.get(poemIndex);
                TopicContent content = repository.find(poem.title());
                if (content == null && request.missingContentPolicy() == MissingContentPolicy.SKIP) {
                    // 业务上 skip 策略明确记录被跳过篇目，不生成任何临时占位图片。
                    LOGGER.warning("缺少审校故事内容，已跳过 source=" + source + ", title=" + poem.title());
                    continue;
                }
                if (content == null) {
                    // 业务上默认 fail，阻止程序用未经核定的通用话术填充古诗故事。
                    throw new IllegalArgumentException("缺少审校故事内容 source=" + source + ", title=" + poem.title());
                }
                // 业务上文件名前缀固定三位源顺序，保证资源管理器按教材顺序排序。
                String fileName = String.format(
                    Locale.ROOT,
                    "%03d_%s.jpg",
                    poemIndex + 1,
                    sanitizeFileName(poem.title())
                );
                Path target = sourceOutputDirectory.resolve(fileName);
                // 业务上主题插画必须经过 JSON 显式绑定，防止批量任务把错误篇目的图片套入当前古诗。
                Path illustrationPath = repository.illustrationPath(content);
                // 业务上通用书卷装饰同样由 JSON 显式绑定，允许不同教材选择各自一致的插画体系。
                Path studyIllustrationPath = repository.studyIllustrationPath(content);
                // 业务上所有文字由 Java2D 从核定数据绘制，主题模型只提供不含文字的审校插画素材。
                BufferedImage image = DocTopicImageRenderer.render(
                    poem,
                    content,
                    illustrationPath,
                    studyIllustrationPath
                );
                DocTopicImageRenderer.writeJpeg(image, target, request.overwrite());
                // 业务上写出后重新解码并检查尺寸，提前发现损坏或错误编码格式。
                validateImage(target);
                imageCount++;
                LOGGER.info("已生成 source=" + source.getFileName() + ", title=" + poem.title() + ", target=" + target);
            }
            // 业务上生成前后哈希必须一致，任何源 DOCX 变化都视为严重保护失败。
            String sourceHashAfter = sha256(source);
            if (!sourceHashBefore.equals(sourceHashAfter)) {
                throw new IllegalStateException("源 DOCX 在生成过程中发生变化: " + source);
            }
        }
        // 业务上返回绝对输出根目录，日志和后续自动化可直接定位交付文件。
        return new GenerationSummary(sources.size(), imageCount, request.outputRoot().toAbsolutePath().normalize());
    }

    /**
     * 解析命令行参数。
     *
     * @param args 原始参数
     * @return 生成请求
     */
    static GenerationRequest parseArguments(String[] args) {
        // 业务上参数采用成对 key/value 形式，避免同一选项由位置猜测。
        if (args.length % 2 != 0) {
            throw new IllegalArgumentException("参数必须按 --key value 成对提供");
        }
        Map<String, String> values = new LinkedHashMap<>();
        for (int index = 0; index < args.length; index += 2) {
            String key = args[index];
            String value = args[index + 1];
            // 业务上重复参数通常表示脚本配置错误，禁止后值静默覆盖前值。
            if (!key.startsWith("--") || values.putIfAbsent(key.substring(2), value) != null) {
                throw new IllegalArgumentException("非法或重复参数: " + key);
            }
        }
        List<String> supported = List.of(
            "source",
            "source-root",
            "output-root",
            "topic-data",
            "limit",
            "overwrite",
            "missing-content"
        );
        // 业务上未知参数直接失败，防止拼错参数后使用默认目录批量写错位置。
        values.keySet().stream().filter(key -> !supported.contains(key)).findFirst().ifPresent(key -> {
            throw new IllegalArgumentException("不支持的参数: --" + key);
        });
        Path source = optionalPath(values.get("source"));
        Path sourceRoot = optionalPath(values.get("source-root"));
        Path outputRoot = requiredPath(values, "output-root");
        Path topicData = requiredPath(values, "topic-data");
        // 业务上 limit 默认为零表示全部篇目，负数不具有有效业务含义。
        int limit = Integer.parseInt(values.getOrDefault("limit", "0"));
        // 业务上覆盖必须显式写 true，默认保护已有人工检查结果。
        boolean overwrite = Boolean.parseBoolean(values.getOrDefault("overwrite", "false"));
        // 业务上缺内容默认失败；只有明确 skip 才允许继续处理其它篇目。
        MissingContentPolicy policy = MissingContentPolicy.from(values.getOrDefault("missing-content", "fail"));
        return new GenerationRequest(source, sourceRoot, outputRoot, topicData, limit, overwrite, policy);
    }

    /**
     * 校验生成请求。
     *
     * @param request 请求
     */
    private static void validateRequest(GenerationRequest request) {
        // 业务上 source 与 source-root 必须且只能选择一个，避免重复处理同一文件。
        if ((request.source() == null) == (request.sourceRoot() == null)) {
            throw new IllegalArgumentException("必须且只能提供 --source 或 --source-root");
        }
        if (request.limit() < 0) {
            // 业务上负数 limit 不允许隐式解释为全部，防止脚本参数错误被掩盖。
            throw new IllegalArgumentException("--limit 不能小于 0");
        }
        // 业务上输出根目录不能指向故事 JSON 文件，避免路径类型混淆。
        if (request.outputRoot().equals(request.topicData())) {
            throw new IllegalArgumentException("输出根目录不能与故事 JSON 相同");
        }
    }

    /**
     * 收集并排序源 DOCX。
     *
     * @param request 请求
     * @return 稳定文件序列
     * @throws IOException 目录扫描失败
     */
    private static List<Path> collectSources(GenerationRequest request) throws IOException {
        if (request.source() != null) {
            // 业务上单文件模式也使用与批量模式相同的扩展名和存在性校验。
            validateSource(request.source());
            return List.of(request.source().toAbsolutePath().normalize());
        }
        if (!Files.isDirectory(request.sourceRoot())) {
            // 业务上批量源必须是目录，不能把不存在目录误当作零文件成功。
            throw new IllegalArgumentException("批量源目录不存在: " + request.sourceRoot());
        }
        List<Path> sources = new ArrayList<>();
        try (var stream = Files.list(request.sourceRoot())) {
            // 业务上第一阶段只扫描目录第一层，避免意外重复处理归档子目录。
            stream.filter(Files::isRegularFile)
                .filter(path -> path.getFileName().toString().toLowerCase().endsWith(".docx"))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .forEach(sources::add);
        }
        if (sources.isEmpty()) {
            // 业务上空批量目录不是成功结果，调用方需要明确放入原文件后重试。
            throw new IllegalArgumentException("批量源目录没有 DOCX: " + request.sourceRoot());
        }
        // 业务上返回不可变排序列表，使不同系统上的处理顺序稳定。
        return List.copyOf(sources);
    }

    /**
     * 校验单个源文件。
     */
    private static void validateSource(Path source) {
        // 业务上只允许可读 DOCX，旧 DOC 必须先另存为稳定副本。
        if (!Files.isRegularFile(source) || !Files.isReadable(source)
            || !source.getFileName().toString().toLowerCase().endsWith(".docx")) {
            throw new IllegalArgumentException("源文件必须是可读 DOCX: " + source);
        }
    }

    /**
     * 校验已写出的图片。
     *
     * @param target JPG 路径
     * @throws IOException 图片无法读取
     */
    private static void validateImage(Path target) throws IOException {
        BufferedImage image = ImageIO.read(target.toFile());
        if (image == null
            || image.getWidth() != DocTopicImageRenderer.WIDTH
            || image.getHeight() != DocTopicImageRenderer.HEIGHT) {
            // 业务上扩展名、编码和尺寸任一异常都不能作为成功图片交付。
            throw new IllegalStateException("生成图片无法重读或尺寸异常: " + target);
        }
    }

    /**
     * 计算源文件 SHA-256。
     */
    private static String sha256(Path path) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            // 业务上流式读取大 DOCX，避免批量任务把全部源文件同时加载到内存。
            try (InputStream inputStream = Files.newInputStream(path, StandardOpenOption.READ);
                 DigestInputStream digestInputStream = new DigestInputStream(inputStream, digest)) {
                digestInputStream.transferTo(java.io.OutputStream.nullOutputStream());
            }
            // 业务上十六进制哈希用于前后精确比较，不依赖文件时间戳。
            return java.util.HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) {
            // 业务上标准 JDK 必须提供 SHA-256，缺失视为运行环境不可用。
            throw new IllegalStateException("当前 Java 缺少 SHA-256", exception);
        }
    }

    /**
     * 去除文件扩展名。
     */
    static String baseName(String fileName) {
        // 业务上只移除最后一个扩展名，保留文件名中其它点号信息。
        int dot = fileName.lastIndexOf('.');
        return sanitizeFileName(dot > 0 ? fileName.substring(0, dot) : fileName);
    }

    /**
     * 生成跨平台安全文件名。
     */
    static String sanitizeFileName(String value) {
        // 业务上替换 Windows 和 macOS 不安全字符，同时保留中文篇名可读性。
        String sanitized = value.replaceAll("[\\\\/:*?\"<>|]", "_").strip();
        if (sanitized.isEmpty()) {
            // 业务上空文件名无法建立可追溯目录，必须显式失败。
            throw new IllegalArgumentException("文件名清理后为空: " + value);
        }
        return sanitized;
    }

    /**
     * 读取可选路径。
     */
    private static Path optionalPath(String value) {
        // 业务上未提供的可选路径保持 null，用于 source/source-root 二选一校验。
        return value == null || value.isBlank() ? null : Path.of(value).toAbsolutePath().normalize();
    }

    /**
     * 读取必填路径。
     */
    private static Path requiredPath(Map<String, String> values, String key) {
        String value = values.get(key);
        if (value == null || value.isBlank()) {
            // 业务上必填路径缺失时在任何文件读取或写入前终止。
            throw new IllegalArgumentException("缺少 --" + key);
        }
        return Path.of(value).toAbsolutePath().normalize();
    }

    /**
     * 缺少审校内容时的批处理策略。
     */
    public enum MissingContentPolicy {
        /** 缺少任一篇内容即失败。 */
        FAIL,
        /** 记录并跳过缺少内容的篇目。 */
        SKIP;

        /**
         * 从 CLI 文本解析策略。
         */
        private static MissingContentPolicy from(String value) {
            // 业务上仅接受明确的 fail/skip，拼写错误不能回退到危险默认值。
            return switch (value.toLowerCase(Locale.ROOT)) {
                case "fail" -> FAIL;
                case "skip" -> SKIP;
                default -> throw new IllegalArgumentException("--missing-content 只允许 fail 或 skip");
            };
        }
    }

    /**
     * 一次生成请求。
     */
    public record GenerationRequest(
        Path source,
        Path sourceRoot,
        Path outputRoot,
        Path topicData,
        int limit,
        boolean overwrite,
        MissingContentPolicy missingContentPolicy
    ) {
    }

    /**
     * 批处理结果摘要。
     */
    public record GenerationSummary(int sourceCount, int imageCount, Path outputRoot) {
    }
}
