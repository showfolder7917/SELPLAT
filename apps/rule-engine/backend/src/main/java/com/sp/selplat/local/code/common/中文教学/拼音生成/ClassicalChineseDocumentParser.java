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
 * 从“目录 + 分册 + 文言文条目”结构的教材汇总 DOCX 中提取可跨页文章。
 */
public final class ClassicalChineseDocumentParser {

    // 业务上带冒号的年级册标题才是正文边界，目录中的“某册目录”不会进入成品。
    private static final Pattern SECTION_PATTERN = Pattern.compile("[一二三四五六七八九]年级[上下]册[：:]");
    // 业务上星号后的必背说明属于教材管理标签，不属于作品标题或正文。
    private static final Pattern LEARNING_LABEL_PATTERN = Pattern.compile("[+★].*$");
    // 业务上“作者〔朝代〕”是该源文档最常见的署名格式。
    private static final Pattern AUTHOR_DYNASTY_PATTERN = Pattern.compile("^(.+?)〔([^〕]+)〕$");
    // 业务上“选自某书〔朝代〕”保留典籍名作为来源，不虚构个人作者。
    private static final Pattern SOURCE_DYNASTY_PATTERN = Pattern.compile("^选自\\s*(.+?)〔([^〕]+)〕$");
    // 业务上“选自宋代某人的某书”同时提取朝代、作者和来源边界。
    private static final Pattern SOURCE_AUTHOR_PATTERN = Pattern.compile("^选自([先秦汉唐宋元明清近现代]+)(.+?)的《.+》$");
    // 业务上篇尾“——[宋]朱熹”可反向补全前面没有署名的文章。
    private static final Pattern TRAILING_AUTHOR_PATTERN = Pattern.compile("^——[\\[【]([^]】]+)[]】](.+)$");
    // 业务上篇尾典籍来源只作为署名行，不混入正文。
    private static final Pattern TRAILING_SOURCE_PATTERN = Pattern.compile("^——《([^》]+)》$");
    // 业务上少数没有署名行的固定教材篇目使用明确的典籍信息兜底。
    private static final Map<String, Metadata> KNOWN_METADATA = Map.ofEntries(
        Map.entry("《弟子规·谨》（节选）", new Metadata("清", "李毓秀")),
        Map.entry("《弟子规·信》（节选）", new Metadata("清", "李毓秀")),
        Map.entry("《世说新语·咏雪》", new Metadata("南朝宋", "刘义庆")),
        Map.entry("《世说新语·陈太丘与友期行》", new Metadata("南朝宋", "刘义庆")),
        Map.entry("《论语》十二章", new Metadata("先秦", "《论语》")),
        Map.entry("得道多助，失道寡助", new Metadata("先秦", "《孟子》")),
        Map.entry("富贵不能淫", new Metadata("先秦", "《孟子》")),
        Map.entry("生于忧患，死于安乐", new Metadata("先秦", "《孟子》")),
        Map.entry("北冥有鱼", new Metadata("先秦", "《庄子》")),
        Map.entry("庄子与惠子游于濠梁之上", new Metadata("先秦", "《庄子》")),
        Map.entry("虽有嘉肴", new Metadata("西汉", "《礼记》")),
        Map.entry("大道之行也", new Metadata("西汉", "《礼记》")),
        Map.entry("伯牙鼓琴", new Metadata("先秦", "《吕氏春秋》"))
    );
    // 业务上作者单独成段时使用通行时代信息补全统一署名。
    private static final Map<String, Metadata> AUTHOR_METADATA = Map.ofEntries(
        Map.entry("诸葛亮", new Metadata("三国蜀汉", "诸葛亮")),
        Map.entry("蒲松龄", new Metadata("清", "蒲松龄")),
        Map.entry("欧阳修", new Metadata("宋", "欧阳修")),
        Map.entry("刘禹锡", new Metadata("唐", "刘禹锡")),
        Map.entry("周敦颐", new Metadata("宋", "周敦颐")),
        Map.entry("沈括", new Metadata("宋", "沈括")),
        Map.entry("郦道元", new Metadata("北魏", "郦道元")),
        Map.entry("陶弘景", new Metadata("南朝齐梁", "陶弘景")),
        Map.entry("苏轼", new Metadata("宋", "苏轼")),
        Map.entry("吴均", new Metadata("南朝梁", "吴均")),
        Map.entry("陶渊明", new Metadata("东晋", "陶渊明")),
        Map.entry("柳宗元", new Metadata("唐", "柳宗元")),
        Map.entry("魏学洢", new Metadata("明", "魏学洢")),
        Map.entry("韩愈", new Metadata("唐", "韩愈")),
        Map.entry("范仲淹", new Metadata("宋", "范仲淹")),
        Map.entry("张岱", new Metadata("明末清初", "张岱")),
        Map.entry("宋濂", new Metadata("明", "宋濂")),
        Map.entry("司马迁", new Metadata("西汉", "司马迁"))
    );

    /**
     * 工具类不创建实例，确保所有调用共享同一目录过滤和边界判断。
     */
    private ClassicalChineseDocumentParser() {
        // 业务入口统一使用 parse，禁止绕过正文起点与学习标签过滤。
    }

    /**
     * 解析教材汇总文档中的全部文言文。
     *
     * @param sourcePath 只读源 DOCX
     * @return 按源顺序排列的文章
     * @throws IOException DOCX 无法读取
     */
    public static List<Article> parse(Path sourcePath) throws IOException {
        // 业务上先完整读取主文档段落，原版文件只读且不会被 POI 回写。
        List<String> paragraphs = readParagraphs(sourcePath);
        int bodyStart = findBodyStart(paragraphs, sourcePath);
        List<Article> articles = new ArrayList<>();
        MutableArticle current = null;
        for (int index = bodyStart; index < paragraphs.size(); index++) {
            // 业务上只清理两端版式空白，正文内部标点和字符保持原样。
            String text = paragraphs.get(index).strip();
            if (text.isEmpty() || isLearningLabel(text)) {
                // 业务上空段和“课后必背”标签不进入只含标题、署名和正文的成品。
                continue;
            }
            if (SECTION_PATTERN.matcher(text).matches()) {
                // 业务上进入下一分册前先完成当前文章，避免跨年级合并正文。
                current = finishCurrent(current, articles);
                continue;
            }
            if (isContainerHeading(text)) {
                // 业务上“《孟子》三章”等只分组后续独立篇目，自身不生成空白文章页。
                current = finishCurrent(current, articles);
                continue;
            }
            Header inlineHeader = parseInlineHeader(text);
            if (inlineHeader != null) {
                // 业务上“马说 韩愈”等标题作者同段结构直接拆成标准字段。
                current = finishCurrent(current, articles);
                current = new MutableArticle(inlineHeader.title(), inlineHeader.metadata());
                continue;
            }
            int nextIndex = findNextContent(paragraphs, index + 1);
            String nextText = nextIndex < 0 ? "" : paragraphs.get(nextIndex).strip();
            Metadata nextMetadata = parseMetadata(nextText);
            boolean labelledTitle = containsLearningLabel(text);
            boolean titleBeforeMetadata = nextMetadata != null && !looksLikeBody(text);
            boolean standaloneClassicTitle = isStandaloneClassicTitle(text);
            boolean knownTitle = KNOWN_METADATA.containsKey(cleanTitle(text));
            if (labelledTitle || titleBeforeMetadata || standaloneClassicTitle || knownTitle) {
                // 业务上新标题出现时先封存上一篇，再创建新的文章收集器。
                current = finishCurrent(current, articles);
                String title = cleanTitle(text);
                Metadata metadata = titleBeforeMetadata ? nextMetadata : KNOWN_METADATA.get(title);
                current = new MutableArticle(title, metadata);
                if (titleBeforeMetadata) {
                    // 业务上标题后的署名已被当前条目消费，跳过该段避免误进正文。
                    index = nextIndex;
                }
                continue;
            }
            Metadata combinedTitleMetadata = parseCombinedTitleMetadata(text, nextText);
            if (current == null && combinedTitleMetadata != null) {
                // 业务上“司马光〔宋代〕”同时承担标题和时代信息，作者缺失时明确标为佚名。
                current = new MutableArticle(cleanCombinedTitle(text), combinedTitleMetadata);
                continue;
            }
            Metadata trailingMetadata = parseTrailingMetadata(text);
            if (current != null && trailingMetadata != null) {
                // 业务上篇尾来源覆盖缺省署名，但不覆盖源文档已经明确给出的作者。
                current.applyTrailingMetadata(trailingMetadata);
                continue;
            }
            if (current != null && parseMetadata(text) == null) {
                // 业务上只有已进入文章后才收正文，目录残留和孤立署名均被排除。
                current.addParagraph(text);
            }
        }
        // 业务上文档结束时补收最后一篇，避免依赖虚构的下一标题边界。
        finishCurrent(current, articles);
        if (articles.isEmpty()) {
            throw new IllegalArgumentException("源 DOCX 未识别到文言文条目: " + sourcePath);
        }
        // 业务上返回不可变文章序列，渲染阶段不得重排教材篇目。
        return List.copyOf(articles);
    }

    /**
     * 读取包含空段的主文档文本。
     *
     * @param sourcePath 源 DOCX
     * @return 段落文本
     * @throws IOException 文档读取失败
     */
    private static List<String> readParagraphs(Path sourcePath) throws IOException {
        List<String> paragraphs = new ArrayList<>();
        try (InputStream inputStream = Files.newInputStream(sourcePath);
             XWPFDocument document = new XWPFDocument(inputStream)) {
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                // 业务上空段仍保留原顺序，但解析时不会把它输出成无意义空表格。
                String text = paragraph.getText();
                paragraphs.add(text == null ? "" : text);
            }
        }
        return paragraphs;
    }

    /**
     * 查找第一个正文分册标题。
     *
     * @param paragraphs 全部段落
     * @param sourcePath 源路径
     * @return 正文起始索引
     */
    private static int findBodyStart(List<String> paragraphs, Path sourcePath) {
        for (int index = 0; index < paragraphs.size(); index++) {
            // 业务上目录没有冒号，只有正文分册标题命中该规则。
            if (SECTION_PATTERN.matcher(paragraphs.get(index).strip()).matches()) {
                return index;
            }
        }
        throw new IllegalArgumentException("源 DOCX 未找到年级分册正文入口: " + sourcePath);
    }

    /**
     * 查找下一条非空、非学习标签段落。
     *
     * @param paragraphs 全部段落
     * @param startIndex 查找起点
     * @return 内容索引，不存在时为 -1
     */
    private static int findNextContent(List<String> paragraphs, int startIndex) {
        for (int index = startIndex; index < paragraphs.size(); index++) {
            String text = paragraphs.get(index).strip();
            // 业务上标题与署名之间允许夹有空段或必背标签，不影响边界识别。
            if (!text.isEmpty() && !isLearningLabel(text)) {
                return index;
            }
        }
        return -1;
    }

    /**
     * 判断整段是否只是学习标签。
     *
     * @param text 已去两端空白文本
     * @return 是标签时为 true
     */
    private static boolean isLearningLabel(String text) {
        // 业务上独立“★课后必背”不承担标题信息，直接过滤。
        return text.startsWith("★") || text.startsWith("+课");
    }

    /**
     * 判断标题是否内嵌学习标签。
     *
     * @param text 源段落
     * @return 包含标签时为 true
     */
    private static boolean containsLearningLabel(String text) {
        // 业务上正文不包含星号标记，因此该标志可稳定识别无署名标题。
        return text.indexOf('★') >= 0 || text.contains("+课");
    }

    /**
     * 识别没有单独署名的典籍节选标题。
     *
     * @param text 源段落
     * @return 可独立成篇时为 true
     */
    private static boolean isStandaloneClassicTitle(String text) {
        // 业务上短小书名号段落可作为标题；实际典籍来源行会被前一个标题分支提前消费。
        return text.codePointCount(0, text.length()) <= 30 && text.startsWith("《");
    }

    /**
     * 判断是否只是多个独立篇目的分组标题。
     *
     * @param text 源段落
     * @return 不应生成独立文章时为 true
     */
    private static boolean isContainerHeading(String text) {
        // 业务上容器标题只提供篇目归属，后续子篇仍各自从新页开始。
        return text.matches("《(?:孟子)》三章")
            || text.matches("《(?:庄子|礼记)》二则");
    }

    /**
     * 粗略排除明显正文，避免把短署名结构前的正文误识别为标题。
     *
     * @param text 候选标题
     * @return 包含句末标点时为 true
     */
    private static boolean looksLikeBody(String text) {
        // 业务上文章标题不会以正文句号、问号、叹号或引号结束。
        return text.matches(".*[。！？；：”]$");
    }

    /**
     * 解析常见署名格式。
     *
     * @param text 署名候选
     * @return 标准署名，不匹配时为 null
     */
    private static Metadata parseMetadata(String text) {
        Matcher sourceDynasty = SOURCE_DYNASTY_PATTERN.matcher(text);
        if (sourceDynasty.matches()) {
            // 业务上典籍来源去除无意义空格并保留书名，朝代移除“代”后缀统一展示。
            return new Metadata(cleanDynasty(sourceDynasty.group(2)), removeWhitespace(sourceDynasty.group(1)));
        }
        Matcher sourceAuthor = SOURCE_AUTHOR_PATTERN.matcher(text);
        if (sourceAuthor.matches()) {
            // 业务上明确出现作者时使用作者姓名，不把后续书名拼进作者字段。
            return new Metadata(cleanDynasty(sourceAuthor.group(1)), removeWhitespace(sourceAuthor.group(2)));
        }
        Matcher authorDynasty = AUTHOR_DYNASTY_PATTERN.matcher(text);
        if (authorDynasty.matches() && !looksLikeBody(text)) {
            // 业务上普通“作者〔朝代〕”直接转成统一的朝代作者行。
            return new Metadata(cleanDynasty(authorDynasty.group(2)), removeWhitespace(authorDynasty.group(1)));
        }
        Metadata authorMetadata = AUTHOR_METADATA.get(removeWhitespace(text));
        if (authorMetadata != null) {
            // 业务上作者单独成段时按通行时代信息补全朝代，不把姓名误当正文。
            return authorMetadata;
        }
        String compact = removeWhitespace(text);
        if (compact.equals("《吕氏春秋》")) {
            return new Metadata("先秦", "《吕氏春秋》");
        }
        if (compact.equals("《列子》")) {
            return new Metadata("先秦", "《列子》");
        }
        if (compact.equals("《资治通鉴》")) {
            return new Metadata("北宋", "司马光");
        }
        if (compact.equals("《孟子》")) {
            return new Metadata("先秦", "《孟子》");
        }
        if (compact.equals("《战国策》") || compact.equals("战国策")) {
            return new Metadata("西汉", "刘向");
        }
        if (compact.startsWith("《左传》")) {
            return new Metadata("春秋", "左丘明");
        }
        if (compact.startsWith("选自司马迁《史记》")) {
            return new Metadata("西汉", "司马迁");
        }
        return null;
    }

    /**
     * 解析标题和作者位于同一段落的结构。
     *
     * @param text 源段落
     * @return 标题头，不匹配时为 null
     */
    private static Header parseInlineHeader(String text) {
        String stripped = LEARNING_LABEL_PATTERN.matcher(text).replaceFirst("").strip();
        for (Map.Entry<String, Metadata> entry : AUTHOR_METADATA.entrySet()) {
            String suffix = " " + entry.getKey();
            if (stripped.endsWith(suffix)) {
                // 业务上只在末尾完整作者名前拆分，正文中的同名词不会触发标题边界。
                String title = cleanTitle(stripped.substring(0, stripped.length() - suffix.length()));
                return new Header(title, entry.getValue());
            }
        }
        return null;
    }

    /**
     * 识别标题与时代合并、但作者缺失的特殊条目。
     *
     * @param text 当前段落
     * @param nextText 下一内容段落
     * @return 时代和佚名署名，不匹配时为 null
     */
    private static Metadata parseCombinedTitleMetadata(String text, String nextText) {
        Matcher matcher = AUTHOR_DYNASTY_PATTERN.matcher(text);
        // 业务上仅在下一项是学习标签或正文时采用合并标题规则，避免抢占正常作者署名。
        if (matcher.matches() && (isLearningLabel(nextText) || looksLikeBody(nextText))) {
            return new Metadata(cleanDynasty(matcher.group(2)), "佚名");
        }
        return null;
    }

    /**
     * 从标题与时代合并段落中提取标题。
     *
     * @param text 合并段落
     * @return 不含时代括号的标题
     */
    private static String cleanCombinedTitle(String text) {
        Matcher matcher = AUTHOR_DYNASTY_PATTERN.matcher(text);
        // 业务上调用前已经验证格式，此处分支仍保留原文兜底，避免异常吞掉标题。
        return matcher.matches() ? removeWhitespace(matcher.group(1)) : cleanTitle(text);
    }

    /**
     * 解析篇尾来源或作者。
     *
     * @param text 篇尾段落
     * @return 可用于补全署名的元数据
     */
    private static Metadata parseTrailingMetadata(String text) {
        Matcher authorMatcher = TRAILING_AUTHOR_PATTERN.matcher(text);
        if (authorMatcher.matches()) {
            // 业务上方括号内时代和后续作者均按可读形式标准化。
            return new Metadata(cleanDynasty(authorMatcher.group(1)), removeWhitespace(authorMatcher.group(2)));
        }
        Matcher sourceMatcher = TRAILING_SOURCE_PATTERN.matcher(text);
        if (sourceMatcher.matches()) {
            // 业务上《论语》属于先秦典籍，作为来源显示而不虚构单一作者。
            return new Metadata("先秦", "《" + sourceMatcher.group(1) + "》");
        }
        return null;
    }

    /**
     * 清理标题中的标签和排版空格。
     *
     * @param text 源标题
     * @return 可显示标题
     */
    private static String cleanTitle(String text) {
        // 业务上只删除教材管理标签和排版空格，不改标题字形与括号形式。
        return removeWhitespace(LEARNING_LABEL_PATTERN.matcher(text).replaceFirst(""));
    }

    /**
     * 统一朝代显示。
     *
     * @param dynasty 源朝代
     * @return 不带“代”后缀的朝代
     */
    private static String cleanDynasty(String dynasty) {
        // 业务上只把“宋代”等单一朝代后缀标准化，不能把“近现代”错误截成“近现”。
        return removeWhitespace(dynasty).replaceFirst("^(先秦|汉|唐|宋|元|明|清)代$", "$1");
    }

    /**
     * 移除结构字段中的全部排版空白。
     *
     * @param text 结构字段
     * @return 连续可读文本
     */
    private static String removeWhitespace(String text) {
        // 业务上该方法只用于标题和署名，不用于正文内容。
        return text.replaceAll("\\s+", "");
    }

    /**
     * 完成当前文章并追加到结果。
     *
     * @param current 当前收集器
     * @param articles 输出列表
     * @return 始终为 null，便于调用方清空当前状态
     */
    private static MutableArticle finishCurrent(MutableArticle current, List<Article> articles) {
        if (current != null) {
            // 业务上无正文条目会在 toArticle 中失败，避免输出只有标题的空白页面。
            articles.add(current.toArticle());
        }
        return null;
    }

    /**
     * 单篇文言文的稳定输出结构。
     *
     * @param title 标题
     * @param dynasty 朝代
     * @param author 作者或典籍来源
     * @param paragraphs 正文段落
     */
    public record Article(String title, String dynasty, String author, List<String> paragraphs) {

        /**
         * 固化文章字段和正文顺序。
         */
        public Article {
            // 业务上标题、朝代、作者和正文均为正式输出必填项。
            if (title.isBlank() || dynasty.isBlank() || author.isBlank() || paragraphs.isEmpty()) {
                throw new IllegalArgumentException("文言文结构不完整: " + title);
            }
            // 业务上正文转为不可变副本，渲染阶段不能删改教材内容。
            paragraphs = List.copyOf(paragraphs);
        }

        /**
         * 按阅读列宽拆分长段，优先在标点后换行。
         *
         * @param maximumColumns 每行最大 Unicode 码点数
         * @return 保持全部原文字符顺序的显示行
         */
        public List<String> displayLines(int maximumColumns) {
            if (maximumColumns < 4) {
                throw new IllegalArgumentException("文言文显示列数不能小于 4");
            }
            List<String> lines = new ArrayList<>();
            for (String paragraph : paragraphs) {
                // 业务上每个源段独立拆行，段落之间不合并，避免改变原文停连层次。
                wrapParagraph(paragraph, maximumColumns, lines);
            }
            return List.copyOf(lines);
        }

        /**
         * 转为现有稳定渲染器可消费的作品结构。
         *
         * @param maximumColumns 正文最大列数
         * @return 标题、署名和已拆行正文
         */
        public PoetryDocumentParser.Poem toRenderableWork() {
            // 业务上把完整段落交给渲染器先注音后拆行，避免多音词和“一、不”在转换前失去上下文。
            return new PoetryDocumentParser.Poem(title, dynasty, author, paragraphs);
        }
    }

    /**
     * 将一个正文段拆成不超过页面列宽的显示行。
     *
     * @param paragraph 原文段落
     * @param maximumColumns 最大列数
     * @param target 输出行
     */
    private static void wrapParagraph(String paragraph, int maximumColumns, List<String> target) {
        int[] codePoints = paragraph.codePoints().toArray();
        int start = 0;
        while (start < codePoints.length) {
            // 业务上先确定不超过最大列数的候选末尾，再向前寻找自然标点停顿。
            int hardEnd = Math.min(codePoints.length, start + maximumColumns);
            int end = hardEnd;
            if (hardEnd < codePoints.length) {
                int preferredMinimum = Math.min(hardEnd, start + Math.max(4, maximumColumns / 2));
                for (int index = hardEnd - 1; index >= preferredMinimum; index--) {
                    if (isBreakPunctuation(codePoints[index])) {
                        // 业务上标点保留在当前行末，下一行从标点后的原字符继续。
                        end = index + 1;
                        break;
                    }
                }
            }
            if (end > start + 1 && (codePoints[end - 1] == '一' || codePoints[end - 1] == '不')
                && Character.UnicodeScript.of(codePoints[end]) == Character.UnicodeScript.HAN) {
                // 业务上“一、不”不能落在行末与后字分离，否则朗读变调会因显示拆行丢失语境。
                end--;
            }
            // 业务上按码点重建显示行，任何字符都不会因 UTF-16 截断或换行而丢失。
            target.add(new String(codePoints, start, end - start));
            start = end;
        }
    }

    /**
     * 判断是否适合作为文言文显示行的停顿点。
     *
     * @param codePoint 原文码点
     * @return 可在其后换行时为 true
     */
    private static boolean isBreakPunctuation(int codePoint) {
        // 业务上优先使用教材原有句读，不额外添加或删除任何标点。
        return "，。；！？：、”」』".indexOf(codePoint) >= 0;
    }

    /**
     * 正在收集正文的可变文章。
     */
    private static final class MutableArticle {

        // 业务上标题在边界识别时固定，不允许后续正文覆盖。
        private final String title;
        // 业务上署名允许篇尾来源补全，因此收集阶段保持可变。
        private Metadata metadata;
        // 业务上正文按原版段落顺序追加。
        private final List<String> paragraphs = new ArrayList<>();

        /**
         * 创建文章收集器。
         *
         * @param title 标题
         * @param metadata 可选署名
         */
        private MutableArticle(String title, Metadata metadata) {
            // 业务上标题进入收集器后立即固定，避免后续启发式判断改变篇目名称。
            this.title = title;
            // 业务上无署名时暂用未知状态，等待篇尾来源或最终明确兜底。
            this.metadata = metadata;
        }

        /**
         * 追加正文段落。
         *
         * @param paragraph 原文正文
         */
        private void addParagraph(String paragraph) {
            // 业务上正文只追加非空内容，标点和内部空格原样保留。
            paragraphs.add(paragraph);
        }

        /**
         * 使用篇尾来源补全署名。
         *
         * @param trailing 篇尾元数据
         */
        private void applyTrailingMetadata(Metadata trailing) {
            // 业务上篇尾来源是该类条目的直接署名证据，允许替换缺失或佚名信息。
            if (metadata == null || "佚名".equals(metadata.author())) {
                metadata = trailing;
            }
        }

        /**
         * 转为不可变文章。
         *
         * @return 完整文章结构
         */
        private Article toArticle() {
            // 业务上源文档未给作者时明确使用“佚名”，不得把标题人物误当作者。
            Metadata resolved = metadata == null ? new Metadata("时代不详", "佚名") : metadata;
            return new Article(title, resolved.dynasty(), resolved.author(), paragraphs);
        }
    }

    /**
     * 已标准化的朝代和作者字段。
     *
     * @param dynasty 朝代
     * @param author 作者或典籍来源
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
