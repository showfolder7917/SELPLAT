package com.sp.selplat.local.code.common.中文教学.拼音生成;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 从“目录 + 分册 + 诗词条目”结构的教材汇总 DOCX 中提取诗词正文。
 */
public final class PoetryDocumentParser {

    // 业务上只有带冒号的年级册标题才是正文分册边界，避免误识别目录文字。
    private static final Pattern SECTION_PATTERN = Pattern.compile("[一二三四五六七八九]年级[上下]册[：:]");
    // 业务上常规署名按“朝代 + 作者”捕获，并在作者字段前停止消费必背标签。
    private static final Pattern STANDARD_METADATA_PATTERN = Pattern.compile("^【([^】]+)】([^★+]+).*$");
    // 业务上部分汇总文档把作者放在朝代前面，例如“陈毅【近现代】”。
    private static final Pattern REVERSED_METADATA_PATTERN = Pattern.compile("^([^【】]+)【([^】]+)】$");
    // 业务上部分词作把标题、朝代和作者合并在同一段落中。
    private static final Pattern INLINE_METADATA_PATTERN = Pattern.compile("^(.+?)\\s*【([^】]+)】([^★+]+)$");
    // 业务上《诗经》等无个人作者作品可能把标题和典籍来源写在同一段落。
    private static final Pattern INLINE_SOURCE_PATTERN = Pattern.compile("^(.+?)\\s+(《[^》]+》)$");
    // 业务上少数正文缺失署名时使用教材通行署名兜底，不依赖错误的单字猜测。
    private static final Map<String, Metadata> KNOWN_METADATA = Map.of(
        "月夜", new Metadata("唐", "刘方平")
    );

    /**
     * 工具类不创建实例，避免解析规则被误当作有状态配置修改。
     */
    private PoetryDocumentParser() {
        // 业务入口统一使用 parse，保证目录过滤和署名标准化总是同时执行。
    }

    /**
     * 解析教材汇总文档中的全部诗词。
     *
     * @param sourcePath 只读源 DOCX
     * @return 按源文档顺序排列的诗词
     * @throws IOException DOCX 无法读取
     * @throws IllegalArgumentException 文档不包含可识别的分册正文或诗词条目
     */
    public static List<Poem> parse(Path sourcePath) throws IOException {
        // 业务上保留空段落，后续可识别词牌上下阕之间的原始分隔。
        List<String> paragraphs = readParagraphs(sourcePath);
        int bodyStart = findBodyStart(paragraphs, sourcePath);
        List<Poem> poems = new ArrayList<>();
        MutablePoem currentPoem = null;
        for (int index = bodyStart; index < paragraphs.size(); index++) {
            // 业务上只清除段落两端无意义空白，不改变诗句内部字符和标点。
            String text = paragraphs.get(index).strip();
            if (SECTION_PATTERN.matcher(text).matches()) {
                // 业务上分册标题只承担边界作用，不属于任何一首诗的交付内容。
                continue;
            }
            if (text.startsWith("课标必背-课外") || isLearningLabel(text)) {
                // 业务上分组名和必背标签只服务目录管理，不属于作品正文。
                continue;
            }
            if (text.isEmpty()) {
                if (currentPoem != null) {
                    // 业务上正文空段保留为词牌上下阕或组诗内部的阅读分隔。
                    currentPoem.addStanzaBreak();
                }
                continue;
            }
            Header inlineHeader = parseInlineHeader(text);
            if (inlineHeader != null) {
                // 业务上标题与署名同段时直接开始新作品，不能把署名字符混入标题或正文。
                if (currentPoem != null) {
                    poems.add(currentPoem.toPoem());
                }
                currentPoem = new MutablePoem(
                    inlineHeader.title(),
                    inlineHeader.metadata().dynasty(),
                    inlineHeader.metadata().author()
                );
                continue;
            }
            int nextNonEmptyIndex = findNextContent(paragraphs, index + 1);
            Metadata nextMetadata = nextNonEmptyIndex < 0
                ? null
                : parseMetadata(cleanTitle(text), paragraphs.get(nextNonEmptyIndex).strip());
            boolean titleBeforeMetadata = nextMetadata != null && isTitleCandidate(text);
            if (titleBeforeMetadata) {
                // 业务上遇到下一首标题时先完成上一首，避免标题被误收进上一首正文。
                if (currentPoem != null) {
                    poems.add(currentPoem.toPoem());
                }
                // 业务上标题中的分散空格来自原文排版，输出时合并为正常可读标题。
                currentPoem = new MutablePoem(cleanTitle(text), nextMetadata.dynasty(), nextMetadata.author());
                index = nextNonEmptyIndex;
                continue;
            }
            Metadata knownMetadata = KNOWN_METADATA.get(cleanTitle(text));
            if (knownMetadata != null && isTitleCandidate(text)) {
                // 业务上源正文漏写署名时使用明确的教材作品署名开始新作品。
                if (currentPoem != null) {
                    poems.add(currentPoem.toPoem());
                }
                currentPoem = new MutablePoem(cleanTitle(text), knownMetadata.dynasty(), knownMetadata.author());
                continue;
            }
            if (currentPoem == null) {
                // 业务上正文开始前的目录残留和已经由标题分支消费的署名行均不进入诗句。
                continue;
            }
            // 业务上诗句按源段落顺序保存，不拆句、不合句，也不改写原文标点。
            currentPoem.addLine(text);
        }
        if (currentPoem != null) {
            // 业务上文档结束时补收最后一首，避免依赖虚构的下一条边界。
            poems.add(currentPoem.toPoem());
        }
        if (poems.isEmpty()) {
            throw new IllegalArgumentException("源 DOCX 未识别到诗词条目: " + sourcePath);
        }
        // 业务上返回不可变列表，防止渲染阶段重排或删改已确认的诗词顺序。
        return List.copyOf(poems);
    }

    /**
     * 读取正文级段落文本。
     *
     * @param sourcePath 源 DOCX
     * @return 包含空段落的文本列表
     * @throws IOException 文档读取失败
     */
    private static List<String> readParagraphs(Path sourcePath) throws IOException {
        // 业务上仅消费主文档段落，不触碰页眉、页脚、批注和源文件 OOXML。
        List<String> paragraphs = new ArrayList<>();
        try (InputStream inputStream = Files.newInputStream(sourcePath);
             XWPFDocument document = new XWPFDocument(inputStream)) {
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                // 业务上 POI 对空段返回空字符串，显式保留它以供分节判断。
                String text = paragraph.getText();
                paragraphs.add(text == null ? "" : text);
            }
        }
        return paragraphs;
    }

    /**
     * 定位第一个实际分册标题，排除前置目录。
     *
     * @param paragraphs 全部段落
     * @param sourcePath 源路径，用于错误提示
     * @return 正文起始索引
     * @throws IllegalArgumentException 未找到年级分册正文入口
     */
    private static int findBodyStart(List<String> paragraphs, Path sourcePath) {
        for (int index = 0; index < paragraphs.size(); index++) {
            // 业务上仅带中文或英文冒号的分册标题视为正文入口，目录中的“某册目录”不会误命中。
            if (SECTION_PATTERN.matcher(paragraphs.get(index).strip()).matches()) {
                return index;
            }
        }
        throw new IllegalArgumentException("源 DOCX 未找到年级分册正文入口: " + sourcePath);
    }

    /**
     * 查找后续首个非空段落。
     *
     * @param paragraphs 全部段落
     * @param startIndex 查找起点
     * @return 段落索引，不存在时为 -1
     */
    private static int findNextContent(List<String> paragraphs, int startIndex) {
        for (int index = startIndex; index < paragraphs.size(); index++) {
            // 业务上允许标题与署名之间存在版式空段或必背标签，不因此丢失作品边界。
            String text = paragraphs.get(index).strip();
            if (!text.isEmpty() && !isLearningLabel(text)) {
                return index;
            }
        }
        return -1;
    }

    /**
     * 判断段落是否属于支持的署名格式。
     *
     * @param text 已去除两端空白的段落
     * @return 属于署名时为 true
     */
    private static boolean isLearningLabel(String text) {
        // 业务上星号和加号开头的整段均是学习标签，不参与标题、署名或正文。
        return text.startsWith("★") || text.startsWith("+课");
    }

    /**
     * 解析并标准化朝代和作者。
     *
     * @param text 源署名段落
     * @return 标准署名；不是署名时为 null
     */
    private static Metadata parseMetadata(String title, String text) {
        Matcher standardMatcher = STANDARD_METADATA_PATTERN.matcher(text);
        if (standardMatcher.matches()) {
            // 业务上常规“【朝代】作者”只移除作者中的排版空格和后附必背标签。
            return new Metadata(removeWhitespace(standardMatcher.group(1)), removeWhitespace(standardMatcher.group(2)));
        }
        Matcher reversedMatcher = REVERSED_METADATA_PATTERN.matcher(text);
        if (reversedMatcher.matches()) {
            // 业务上反向署名统一转换成“朝代 + 作者”，输出层不保留来源顺序差异。
            return new Metadata(removeWhitespace(reversedMatcher.group(2)), removeWhitespace(reversedMatcher.group(1)));
        }
        if (text.startsWith("汉乐府")) {
            // 业务上乐府作品统一显示来源时代和署名类型，满足朝代必须可见的要求。
            return new Metadata("汉", "乐府");
        }
        if (text.startsWith("北朝民歌")) {
            // 业务上民歌没有个人作者，保留“民歌”而不虚构姓名。
            return new Metadata("北朝", "民歌");
        }
        if (text.startsWith("毛泽东")) {
            // 业务上源文档未标时代，按作者所处时期补充“现代”以统一输出字段。
            return new Metadata("现代", "毛泽东");
        }
        if (text.equals("李煜（五代）") || text.equals("李煜(五代)")) {
            // 业务上括号式时代署名统一为方括号朝代与作者行。
            return new Metadata("五代", "李煜");
        }
        if (text.equals("《古诗十九首》") || text.startsWith("选自《古诗十九首》")) {
            // 业务上《古诗十九首》按汉代无名氏作品展示，来源书名不混入作者字段。
            return new Metadata("汉", "佚名");
        }
        if (text.startsWith("《诗经·")) {
            // 业务上《诗经》作品按先秦无名氏展示，使朝代和作者字段完整且不虚构个人姓名。
            return new Metadata("先秦", "佚名");
        }
        if (text.equals("《乐府诗集》")) {
            // 业务上同一总集中的作品按具体标题区分汉乐府与北朝民歌。
            return "木兰诗".equals(title)
                ? new Metadata("北朝", "民歌")
                : new Metadata("汉", "乐府");
        }
        return null;
    }

    /**
     * 解析标题与署名合并段落。
     *
     * @param text 源段落
     * @return 完整标题头，不匹配时为 null
     */
    private static Header parseInlineHeader(String text) {
        Matcher metadataMatcher = INLINE_METADATA_PATTERN.matcher(text);
        if (metadataMatcher.matches()) {
            // 业务上标题位于朝代括号前、作者位于括号后，三部分分别标准化。
            return new Header(
                cleanTitle(metadataMatcher.group(1)),
                new Metadata(removeWhitespace(metadataMatcher.group(2)), removeWhitespace(metadataMatcher.group(3)))
            );
        }
        Matcher sourceMatcher = INLINE_SOURCE_PATTERN.matcher(text);
        if (sourceMatcher.matches()) {
            String title = cleanTitle(sourceMatcher.group(1));
            Metadata metadata = parseMetadata(title, sourceMatcher.group(2));
            if (metadata != null) {
                // 业务上标题与典籍来源同段时使用标题语境裁决朝代和作者类型。
                return new Header(title, metadata);
            }
        }
        return null;
    }

    /**
     * 判断文本是否可作为作品标题。
     *
     * @param text 候选文本
     * @return 不含正文句末标点且长度合理时为 true
     */
    private static boolean isTitleCandidate(String text) {
        // 业务上标题允许中点和括号，但不会以正文句号、问号、叹号、分号或引号结束。
        return text.codePointCount(0, text.length()) <= 40 && !text.matches(".*[。！？；”]$");
    }

    /**
     * 移除字段中的全部排版空白。
     *
     * @param text 标题、朝代或作者字段
     * @return 连续可读字段
     */
    private static String removeWhitespace(String text) {
        // 业务上仅对结构字段去空格，诗句正文不使用此方法，避免改变原句。
        return text.replaceAll("\\s+", "");
    }

    /**
     * 清理标题中的版式空白和学习标签。
     *
     * @param text 源标题段落
     * @return 仅包含作品标题的文本
     */
    private static String cleanTitle(String text) {
        // 业务上“必背”等标签属于教材管理信息，不是诗名，必须在输出标题中删除。
        String titleWithoutLabel = text.replaceFirst("[+★].*$", "");
        // 业务上再合并源排版产生的分散空格，恢复正常连续标题。
        return removeWhitespace(titleWithoutLabel);
    }

    /**
     * 一首诗的稳定输出结构。
     *
     * @param title 标题
     * @param dynasty 朝代
     * @param author 作者或作品类型
     * @param lines 正文行，空字符串表示分节
     */
    public record Poem(String title, String dynasty, String author, List<String> lines) {

        /**
         * 固化正文，避免调用方修改解析结果。
         *
         * @throws IllegalArgumentException 标题、朝代、作者或正文不完整
         */
        public Poem {
            // 业务上每个输出字段都必须存在，防止生成缺标题、缺朝代或缺作者的页面。
            if (title.isBlank() || dynasty.isBlank() || author.isBlank()) {
                throw new IllegalArgumentException("诗词标题、朝代和作者不能为空");
            }
            // 业务上无正文的条目视为边界误判，不生成看似完整的空白诗页。
            if (lines.stream().noneMatch(line -> !line.isBlank())) {
                throw new IllegalArgumentException("诗词正文不能为空: " + title);
            }
            lines = List.copyOf(lines);
        }

        /**
         * 返回统一显示的朝代作者行。
         *
         * @return 例如“【唐】李白”
         */
        public String attribution() {
            // 业务上朝代始终使用醒目的方头括号，与教材常见署名格式一致。
            return "【" + dynasty + "】" + author;
        }
    }

    /**
     * 尚在收集正文的可变条目。
     */
    private static final class MutablePoem {

        // 业务上标题在识别条目边界时固定，收集正文期间不允许再次替换。
        private final String title;
        // 业务上朝代在署名解析后固定，确保每个输出页面都显示相同来源信息。
        private final String dynasty;
        // 业务上作者或作品类型在署名解析后固定，不从正文猜测个人姓名。
        private final String author;
        // 业务上正文列表按源顺序累计，空字符串用于保存词牌分节。
        private final List<String> lines = new ArrayList<>();

        /**
         * 创建一个按源文顺序收集正文的诗词条目。
         *
         * @param title 诗词标题
         * @param dynasty 朝代
         * @param author 作者或作品类型
         */
        private MutablePoem(String title, String dynasty, String author) {
            // 业务上边界识别完成后立即固定三个结构字段，后续只允许追加正文。
            this.title = title;
            this.dynasty = dynasty;
            this.author = author;
        }

        /**
         * 按源文顺序追加一行非空正文。
         *
         * @param line 诗词正文行
         */
        private void addLine(String line) {
            // 业务上正文保持源顺序逐行追加，不执行去重或自动断句。
            lines.add(line);
        }

        /**
         * 在已有正文后追加一个不重复的分节标记。
         */
        private void addStanzaBreak() {
            // 业务上只有已有正文且上一项非空时才保存分节，排除署名后的版式空段。
            if (!lines.isEmpty() && !lines.get(lines.size() - 1).isEmpty()) {
                lines.add("");
            }
        }

        /**
         * 移除尾部分节标记并转为不可变诗词结构。
         *
         * @return 可供渲染器使用的诗词结构
         */
        private Poem toPoem() {
            // 业务上输出前移除尾部空段，避免在诗页底部生成无意义留白表格。
            while (!lines.isEmpty() && lines.get(lines.size() - 1).isEmpty()) {
                lines.remove(lines.size() - 1);
            }
            return new Poem(title, dynasty, author, lines);
        }
    }

    /**
     * 已标准化的署名字段。
     *
     * @param dynasty 朝代
     * @param author 作者或作品类型
     */
    private record Metadata(String dynasty, String author) {
    }

    /**
     * 同段标题和署名的标准结构。
     *
     * @param title 标题
     * @param metadata 朝代作者
     */
    private record Header(String title, Metadata metadata) {
    }
}
