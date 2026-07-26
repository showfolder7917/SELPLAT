package com.sp.selplat.code.中文教学.教学图片与PPT生成;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * 加载经过审校的古诗故事与解读内容，阻止图片层自行编造文本。
 */
public final class DocTopicContentRepository {

    // 业务上审校 JSON 由规则引擎直接解析，避免中文教学工具迁移后继续依赖 common-core 的公共工具类。
    private static final ObjectMapper CONTENT_MAPPER = new ObjectMapper();

    // 业务上篇名到内容的映射在加载后保持不可变，保证一次批处理使用同一版本数据。
    private final Map<String, TopicContent> topics;
    // 业务上插画相对路径以审校 JSON 所在目录为基准，整套素材复制到其它系统后无需改绝对路径。
    private final Path contentDirectory;

    /**
     * 创建内容仓库。
     *
     * @param topics 篇名与审校内容
     * @param contentDirectory 审校 JSON 所在目录
     */
    private DocTopicContentRepository(Map<String, TopicContent> topics, Path contentDirectory) {
        // 业务上防御性复制外部映射，避免批处理期间内容被其它调用方修改。
        this.topics = Map.copyOf(topics);
        // 业务上保存规范化目录，后续每篇插画都从同一个可信根目录解析。
        this.contentDirectory = contentDirectory.toAbsolutePath().normalize();
    }

    /**
     * 从 UTF-8 JSON 加载内容。
     *
     * @param path 内容 JSON
     * @return 已校验仓库
     * @throws IOException 文件读取失败
     */
    public static DocTopicContentRepository load(Path path) throws IOException {
        // 业务上故事文件是正式输入，缺失或不可读时不能生成带猜测内容的图片。
        if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new IllegalArgumentException("故事内容 JSON 不存在或不可读: " + path);
        }
        // 业务上显式使用 UTF-8，确保中文、标点和路径在 Windows/macOS 行为一致。
        String json = Files.readString(path, StandardCharsets.UTF_8);
        // 业务上把审校 JSON 反序列化为固定内容结构，后续校验才能阻止图片层自行编造教学文本。
        ContentFile contentFile = CONTENT_MAPPER.readValue(json, ContentFile.class);
        if (contentFile == null || contentFile.topics() == null || contentFile.topics().isEmpty()) {
            // 业务上空内容文件无法支撑故事图片，立即终止而不是输出空栏目。
            throw new IllegalArgumentException("故事内容 JSON 没有 topics: " + path);
        }
        // 业务上逐篇校验栏目，避免批量生成到中途才发现某个必填字段为空。
        contentFile.topics().forEach(TopicContent::validateEntry);
        // 业务上 JSON 一定是普通文件，因此父目录可作为插画相对路径的稳定解析基准。
        return new DocTopicContentRepository(contentFile.topics(), path.toAbsolutePath().normalize().getParent());
    }

    /**
     * 按篇名读取审校内容。
     *
     * @param title 核定版篇名
     * @return 内容，不存在时为 null
     */
    public TopicContent find(String title) {
        // 业务上第一阶段使用核定篇名精确匹配，不做模糊匹配以免同名篇目串内容。
        return topics.get(title);
    }

    /**
     * 解析一篇内容所绑定的审校插画。
     *
     * @param content 审校内容
     * @return 可读插画绝对路径
     */
    public Path illustrationPath(TopicContent content) {
        // 业务上主题图用于诗意故事和自然意境小景，名称单独进入错误信息便于补图。
        return resolveAssetPath(content.illustration(), "主题插画");
    }

    /**
     * 解析一篇内容所绑定的书卷装饰插画。
     *
     * @param content 审校内容
     * @return 可读装饰插画绝对路径
     */
    public Path studyIllustrationPath(TopicContent content) {
        // 业务上书卷图用于解读和思想栏目，与篇目主题图分离以避免四卡重复同一画面。
        return resolveAssetPath(content.studyIllustration(), "书卷装饰插画");
    }

    /**
     * 以内容目录为基准解析并校验图片素材。
     */
    private Path resolveAssetPath(String configuredValue, String assetName) {
        // 业务上允许 JSON 使用相对路径便于整体迁移，也兼容显式绝对路径用于受控流水线。
        Path configuredPath = Path.of(configuredValue);
        Path resolvedPath = configuredPath.isAbsolute()
            ? configuredPath.normalize()
            : contentDirectory.resolve(configuredPath).normalize();
        if (!Files.isRegularFile(resolvedPath) || !Files.isReadable(resolvedPath)) {
            // 业务上配图是正式版式的组成部分，缺失时禁止退化为大片空白区域。
            throw new IllegalArgumentException(assetName + "不存在或不可读: " + resolvedPath);
        }
        return resolvedPath;
    }

    /**
     * JSON 根结构。
     *
     * @param topics 篇名内容映射
     */
    public record ContentFile(Map<String, TopicContent> topics) {
    }

    /**
     * 单篇图片的审校扩展内容。
     *
     * @param story 诗意故事段落
     * @param interpretation 诗句解读段落
     * @param coreIdeas 核心意境要点
     * @param lifeTips 生活启示要点
     * @param footer 页脚总结
     * @param illustration 相对审校 JSON 的主题插画路径
     * @param studyIllustration 相对审校 JSON 的书卷装饰插画路径
     */
    public record TopicContent(
        List<String> story,
        List<String> interpretation,
        List<String> coreIdeas,
        List<String> lifeTips,
        String footer,
        String illustration,
        String studyIllustration
    ) {

        /**
         * 校验一篇内容是否可以进入正式图片。
         *
         * @param title 篇名
         * @param content 内容
         */
        private static void validateEntry(String title, TopicContent content) {
            // 业务上篇名是 DOCX 与内容 JSON 的唯一第一阶段关联键，不能为空。
            if (title == null || title.isBlank() || content == null) {
                throw new IllegalArgumentException("故事内容存在空篇名或空对象");
            }
            // 业务上五个展示栏目必须都有已审校内容，防止图片出现空框或临时占位语。
            if (isBlankList(content.story())
                || isBlankList(content.interpretation())
                || isBlankList(content.coreIdeas())
                || isBlankList(content.lifeTips())
                || content.footer() == null
                || content.footer().isBlank()
                || content.illustration() == null
                || content.illustration().isBlank()
                || content.studyIllustration() == null
                || content.studyIllustration().isBlank()) {
                throw new IllegalArgumentException("故事内容栏目不完整: " + title);
            }
        }

        /**
         * 判断列表是否缺少可显示文字。
         *
         * @param values 文本列表
         * @return 空列表或包含空项时为 true
         */
        private static boolean isBlankList(List<String> values) {
            // 业务上任何空段都会造成栏目版式和语义缺失，因此按整体无效处理。
            return values == null || values.isEmpty() || values.stream().anyMatch(value -> value == null || value.isBlank());
        }
    }
}
