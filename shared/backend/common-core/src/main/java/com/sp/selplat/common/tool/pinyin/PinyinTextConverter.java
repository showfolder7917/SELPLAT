package com.sp.selplat.common.tool.pinyin;

import com.github.houbb.pinyin.constant.enums.PinyinStyleEnum;
import com.github.houbb.pinyin.util.PinyinHelper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 把中文文本转换为与 Unicode 码点逐一对齐的拼音单元。
 */
public final class PinyinTextConverter {

    /**
     * 区分正词法本调与儿童朗读教学标引，防止同一转换器隐式混用两套规则。
     */
    public enum AnnotationMode {
        /** “一、不”保留词汇本调，适用于正词法数据交换。 */
        ORTHOGRAPHY,
        /** “一、不”按稳定语境变调，三声仍保留本调，适用于儿童直接朗读。 */
        READING_TEACHING
    }

    /**
     * 文档渲染时需要区分需要注音的汉字和只需原样保留的字符。
     */
    public enum CellType {
        /** 需要显示拼音的汉字。 */
        HANZI,
        /** 不生成拼音但必须保留位置的中文或西文标点。 */
        PUNCTUATION,
        /** 文档中的空白字符。 */
        WHITESPACE,
        /** 数字、拉丁字母等其它原文字符。 */
        OTHER
    }

    /**
     * 单个原文码点及其最终读音。
     *
     * @param pinyin 带声调拼音；非汉字为空字符串
     * @param text 原始 Unicode 字符
     * @param type 字符业务类型
     */
    public record PinyinCell(String pinyin, String text, CellType type) {
    }

    private final List<OverrideEntry> overrideEntries;
    // 业务上转换模式与词典一起固定在实例中，确保一次文档生成全过程使用同一标引口径。
    private final AnnotationMode annotationMode;

    /**
     * 创建文本转换器。
     *
     * @param overrides 文档专用词组到逐字拼音的映射
     */
    public PinyinTextConverter(Map<String, List<String>> overrides) {
        // 业务上项目默认交付儿童朗读版，旧调用方无需改参数即可使用规范规定的默认模式。
        this(overrides, AnnotationMode.READING_TEACHING);
    }

    /**
     * 创建指定标引模式的文本转换器。
     *
     * @param overrides 文档专用词组到逐字拼音的映射
     * @param annotationMode 正词法本调或朗读教学模式
     */
    public PinyinTextConverter(Map<String, List<String>> overrides, AnnotationMode annotationMode) {
        // 业务上先把长词组排在前面，实现“长词优先”，避免短词提前覆盖更精确的上下文读音。
        this.overrideEntries = overrides.entrySet().stream()
            .map(entry -> new OverrideEntry(entry.getKey(), List.copyOf(entry.getValue())))
            .sorted(Comparator.comparingInt(OverrideEntry::codePointLength).reversed())
            .toList();
        // 业务上模式不能为空，避免 null 被误解释为某种默认读音。
        this.annotationMode = java.util.Objects.requireNonNull(annotationMode, "annotationMode");
    }

    /**
     * 创建不带文档专用纠音的基础转换器。
     *
     * @return 仅使用第三方词组拼音库的转换器
     */
    public static PinyinTextConverter withoutOverrides() {
        // 业务上允许其它文档先使用通用词库生成样稿，再按文档增加独立纠音文件。
        return new PinyinTextConverter(Collections.emptyMap());
    }

    /**
     * 从 UTF-8 TSV 文件加载文档专用纠音词典。
     *
     * @param dictionaryPath 纠音词典路径
     * @return 保持文件顺序的词组纠音映射
     * @throws IOException 词典读取失败
     * @throws IllegalArgumentException 词典格式、音节数或词组唯一性不符合约束
     */
    public static Map<String, List<String>> loadOverrides(Path dictionaryPath) throws IOException {
        // 业务上使用 LinkedHashMap 保留人工词典顺序，发生重复时可以稳定定位到具体配置。
        Map<String, List<String>> overrides = new LinkedHashMap<>();
        // 业务上按 UTF-8 逐行读取，使带声调字符在不同操作系统中保持一致。
        List<String> lines = Files.readAllLines(dictionaryPath, StandardCharsets.UTF_8);
        for (int lineIndex = 0; lineIndex < lines.size(); lineIndex++) {
            // 业务上跳过空行和注释，让纠音文件可以记录校对来源与说明。
            String line = lines.get(lineIndex).strip();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            // 业务上要求词组与拼音严格使用一个制表符分区，避免空格同时承担音节分隔和字段分隔。
            String[] columns = line.split("\\t", -1);
            if (columns.length != 2 || columns[0].isBlank() || columns[1].isBlank()) {
                throw new IllegalArgumentException("纠音词典格式错误 line=" + (lineIndex + 1) + ", content=" + line);
            }
            // 业务上每个拼音音节必须与词组中的一个 Unicode 码点对应。
            List<String> syllables = Arrays.stream(columns[1].trim().split("\\s+"))
                .filter(value -> !value.isBlank())
                .toList();
            int codePointCount = columns[0].codePointCount(0, columns[0].length());
            if (syllables.size() != codePointCount) {
                throw new IllegalArgumentException(
                    "纠音词条音节数不匹配 line=" + (lineIndex + 1) + ", phrase=" + columns[0]
                        + ", expected=" + codePointCount + ", actual=" + syllables.size()
                );
            }
            // 业务上禁止同一词组重复定义，避免最终读音依赖文件中的偶然先后顺序。
            if (overrides.putIfAbsent(columns[0], syllables) != null) {
                throw new IllegalArgumentException("纠音词组重复 line=" + (lineIndex + 1) + ", phrase=" + columns[0]);
            }
        }
        // 业务上向调用方返回不可变数据，防止生成过程中词典被意外修改。
        return Collections.unmodifiableMap(overrides);
    }

    /**
     * 将一段原文转换为逐码点注音单元。
     *
     * @param text 需要处理的原文段落
     * @return 与原文码点数量一致的注音单元
     * @throws IllegalStateException 第三方库无法为某个汉字生成拼音
     */
    public List<PinyinCell> convert(String text) {
        // 业务上以 Unicode 码点而不是 char 为单位，避免扩展区汉字被拆成两个错误单元。
        int[] codePoints = text.codePoints().toArray();
        String[] pinyinByCodePoint = new String[codePoints.length];
        // 业务上先对连续汉字片段进行整词注音，保留第三方库的分词和多音字判断能力。
        fillLibraryPinyin(codePoints, pinyinByCodePoint);
        if (annotationMode == AnnotationMode.READING_TEACHING) {
            // 业务上先应用可稳定推导的朗读变调，再让文档专用词典覆盖序数、专名等语境例外。
            applyReadingTeachingSandhi(codePoints, pinyinByCodePoint);
        }
        // 业务上再应用人工纠音，使文言文上下文规则始终高于第三方库的默认读音。
        applyOverrides(text, pinyinByCodePoint);
        // 业务上最终逐码点创建渲染单元，保证标点和原文位置不会在生成 DOCX 时丢失。
        List<PinyinCell> cells = new ArrayList<>(codePoints.length);
        for (int index = 0; index < codePoints.length; index++) {
            int codePoint = codePoints[index];
            String originalCharacter = new String(Character.toChars(codePoint));
            CellType cellType = classify(codePoint);
            String pinyin = cellType == CellType.HANZI ? pinyinByCodePoint[index] : "";
            // 业务上汉字漏注会直接破坏上下行对齐，因此不允许静默生成空拼音。
            if (cellType == CellType.HANZI && (pinyin == null || pinyin.isBlank())) {
                throw new IllegalStateException("汉字无法注音 index=" + index + ", text=" + originalCharacter);
            }
            cells.add(new PinyinCell(pinyin, originalCharacter, cellType));
        }
        // 业务上返回不可变列表，确保渲染器只消费转换结果而不篡改原文映射。
        return List.copyOf(cells);
    }

    /**
     * 对紧邻后续汉字的“一、不”应用朗读教学版变调。
     *
     * @param codePoints 原文码点
     * @param pinyinByCodePoint 已按语境生成的候选拼音
     */
    private void applyReadingTeachingSandhi(int[] codePoints, String[] pinyinByCodePoint) {
        for (int index = 0; index + 1 < codePoints.length; index++) {
            // 业务上只处理紧邻汉字，遇到标点、空格或句末即视为明确停顿，不跨界触发变调。
            if (!isHanzi(codePoints[index + 1])) {
                continue;
            }
            int current = codePoints[index];
            int nextTone = toneNumber(pinyinByCodePoint[index + 1]);
            if (current == '一') {
                // 业务上“第一”等序数保持 yī；其它紧邻音节按后字本调应用稳定教学变调。
                boolean ordinal = index > 0 && codePoints[index - 1] == '第';
                if (!ordinal && nextTone == 4) {
                    pinyinByCodePoint[index] = "yí";
                } else if (!ordinal && nextTone >= 1 && nextTone <= 3) {
                    pinyinByCodePoint[index] = "yì";
                }
            } else if (current == '不') {
                // 业务上“不”仅在后接四声时写作 bú，其余语境保持本调 bù。
                pinyinByCodePoint[index] = nextTone == 4 ? "bú" : "bù";
            }
        }
    }

    /**
     * 从带调 Unicode 拼音中读取声调编号。
     *
     * @param pinyin 单个带调拼音音节
     * @return 1 至 4；轻声、空值或无法识别时返回 0
     */
    private int toneNumber(String pinyin) {
        if (pinyin == null || pinyin.isBlank()) {
            // 业务上后字没有可靠候选音时不猜测变调，由后续人工词典决定。
            return 0;
        }
        String decomposed = Normalizer.normalize(pinyin, Normalizer.Form.NFD);
        for (int index = 0; index < decomposed.length(); index++) {
            // 业务上按组合调号识别声调，可同时覆盖 a、e、i、o、u、ü 的全部带调形式。
            char value = decomposed.charAt(index);
            if (value == '\u0304') {
                return 1;
            }
            if (value == '\u0301') {
                return 2;
            }
            if (value == '\u030C') {
                return 3;
            }
            if (value == '\u0300') {
                return 4;
            }
        }
        // 业务上轻声不触发可机械判定的“一、不”变调，保留候选本调等待词典裁决。
        return 0;
    }

    /**
     * 使用词组拼音库填充连续汉字片段。
     *
     * @param codePoints 原文码点
     * @param pinyinByCodePoint 拼音结果数组
     */
    private void fillLibraryPinyin(int[] codePoints, String[] pinyinByCodePoint) {
        int runStart = 0;
        while (runStart < codePoints.length) {
            // 业务上标点和其它字符不参与中文分词，直接跨过并保留空拼音。
            if (!isHanzi(codePoints[runStart])) {
                runStart++;
                continue;
            }
            // 业务上寻找当前连续汉字段落的末尾，让词组库可以在完整短句范围内判断多音字。
            int runEnd = runStart + 1;
            while (runEnd < codePoints.length && isHanzi(codePoints[runEnd])) {
                runEnd++;
            }
            // 业务上把当前码点片段还原为字符串并使用制表符分隔结果，避免拼音内部字符被误拆。
            String hanziRun = new String(codePoints, runStart, runEnd - runStart);
            String converted = PinyinHelper.toPinyin(hanziRun, PinyinStyleEnum.DEFAULT, "\t");
            String[] syllables = converted.split("\\t", -1);
            if (syllables.length == runEnd - runStart) {
                // 业务上词组输出数量正确时，整段采用其分词后的读音。
                for (int offset = 0; offset < syllables.length; offset++) {
                    pinyinByCodePoint[runStart + offset] = syllables[offset].trim();
                }
            } else {
                // 业务上第三方库若不能保持逐字数量，则回退到单字注音以保证文档结构绝不错位。
                for (int index = runStart; index < runEnd; index++) {
                    String singleHanzi = new String(Character.toChars(codePoints[index]));
                    pinyinByCodePoint[index] = PinyinHelper.toPinyin(singleHanzi, PinyinStyleEnum.DEFAULT, "").trim();
                }
            }
            runStart = runEnd;
        }
    }

    /**
     * 用最长词组优先规则覆盖第三方库结果。
     *
     * @param text 原文段落
     * @param pinyinByCodePoint 待纠正的逐码点拼音
     */
    private void applyOverrides(String text, String[] pinyinByCodePoint) {
        // 业务上记录已经被更长词组覆盖的位置，防止后续短词组破坏更精确的上下文读音。
        boolean[] overridden = new boolean[pinyinByCodePoint.length];
        for (OverrideEntry entry : overrideEntries) {
            int utf16Offset = text.indexOf(entry.phrase());
            while (utf16Offset >= 0) {
                // 业务上把 Java 字符串偏移转换为码点偏移，确保补充平面字符前的索引仍然准确。
                int codePointStart = text.codePointCount(0, utf16Offset);
                int codePointEnd = codePointStart + entry.codePointLength();
                boolean overlaps = false;
                for (int index = codePointStart; index < codePointEnd; index++) {
                    overlaps |= overridden[index];
                }
                if (!overlaps) {
                    // 业务上只有完整未覆盖区域才应用词条，保证一次匹配不会产生半词覆盖。
                    for (int offset = 0; offset < entry.syllables().size(); offset++) {
                        pinyinByCodePoint[codePointStart + offset] = entry.syllables().get(offset);
                        overridden[codePointStart + offset] = true;
                    }
                }
                // 业务上继续查找同一段落中的后续出现位置，让重复经典句式也能获得一致读音。
                utf16Offset = text.indexOf(entry.phrase(), utf16Offset + entry.phrase().length());
            }
        }
    }

    /**
     * 对原文码点进行渲染类型分类。
     *
     * @param codePoint Unicode 码点
     * @return 文档渲染类型
     */
    private static CellType classify(int codePoint) {
        // 业务上汉字需要显示拼音，并参与最终逐字完整性校验。
        if (isHanzi(codePoint)) {
            return CellType.HANZI;
        }
        // 业务上空格只承担原文排版含义，不应被错误注音。
        if (Character.isWhitespace(codePoint)) {
            return CellType.WHITESPACE;
        }
        // 业务上所有 Unicode 标点均保留原位，但其上方拼音格保持为空。
        int characterType = Character.getType(codePoint);
        if (characterType == Character.CONNECTOR_PUNCTUATION
            || characterType == Character.DASH_PUNCTUATION
            || characterType == Character.START_PUNCTUATION
            || characterType == Character.END_PUNCTUATION
            || characterType == Character.INITIAL_QUOTE_PUNCTUATION
            || characterType == Character.FINAL_QUOTE_PUNCTUATION
            || characterType == Character.OTHER_PUNCTUATION) {
            return CellType.PUNCTUATION;
        }
        // 业务上数字和拉丁字符按其它原文处理，保持字符但不擅自添加中文拼音。
        return CellType.OTHER;
    }

    /**
     * 判断码点是否属于 Unicode 汉字脚本。
     *
     * @param codePoint Unicode 码点
     * @return 属于汉字脚本时为 true
     */
    private static boolean isHanzi(int codePoint) {
        // 业务上按 Unicode Script 判断，覆盖常用汉字和扩展区汉字。
        return Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HAN;
    }

    /**
     * 内部纠音词条及其码点长度。
     *
     * @param phrase 原文词组
     * @param syllables 与词组逐字对应的拼音
     */
    private record OverrideEntry(String phrase, List<String> syllables) {

        /**
         * 返回词组的 Unicode 码点数量。
         *
         * @return 词组码点数量
         */
        private int codePointLength() {
            // 业务上排序和覆盖范围都按码点计算，不能使用 UTF-16 字符单元数量。
            return phrase.codePointCount(0, phrase.length());
        }
    }
}
