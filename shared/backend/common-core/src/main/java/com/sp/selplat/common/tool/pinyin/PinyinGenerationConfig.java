package com.sp.selplat.common.tool.pinyin;

/**
 * 拼音 DOCX 的可复用版式配置。
 *
 * @param pageWidthTwips 页面宽度，单位为 twip
 * @param pageHeightTwips 页面高度，单位为 twip
 * @param horizontalMarginTwips 页面左右边距，单位为 twip
 * @param verticalMarginTwips 页面上下边距，单位为 twip
 * @param titlePinyinFontPoints 标题拼音字号
 * @param titleHanziFontPoints 标题汉字字号
 * @param bodyPinyinFontPoints 正文拼音字号
 * @param bodyHanziFontPoints 正文汉字字号
 * @param pinyinRowHeightTwips 拼音行高度
 * @param hanziRowHeightTwips 汉字行高度
 * @param paragraphGapTwips 注音排之间的留白
 * @param standardColumns 标准正文段落的列数，用于固定不同长度段落的单字宽度
 * @param pinyinFontFamily 拼音字体
 * @param hanziFontFamily 汉字字体
 */
public record PinyinGenerationConfig(
    int pageWidthTwips,
    int pageHeightTwips,
    int horizontalMarginTwips,
    int verticalMarginTwips,
    double titlePinyinFontPoints,
    double titleHanziFontPoints,
    double bodyPinyinFontPoints,
    double bodyHanziFontPoints,
    int pinyinRowHeightTwips,
    int hanziRowHeightTwips,
    int paragraphGapTwips,
    int standardColumns,
    String pinyinFontFamily,
    String hanziFontFamily
) {

    /**
     * 创建参照《道德经（注音可修改版）》视觉比例的稳定 DOCX 配置。
     *
     * @return 通用的道德经式注音版式
     */
    public static PinyinGenerationConfig daodejingStyle() {
        // 业务上使用 A4 纵向页面，让输出在 WPS 和 Microsoft Word 中保持一致的纸张基准。
        int a4WidthTwips = 11906;
        int a4HeightTwips = 16838;
        // 业务上左右使用约 18 mm、上下使用约 20 mm 的留白，接近参考文档的疏朗阅读效果。
        int horizontalMarginTwips = 1021;
        int verticalMarginTwips = 1134;
        // 业务上标题突出、正文清晰，拼音字号保持明显小于对应汉字。
        return new PinyinGenerationConfig(
            a4WidthTwips,
            a4HeightTwips,
            horizontalMarginTwips,
            verticalMarginTwips,
            11.0,
            24.0,
            8.0,
            18.0,
            260,
            420,
            100,
            16,
            "Arial",
            "Songti SC"
        );
    }

    /**
     * 返回页面正文可使用的总宽度。
     *
     * @return 扣除左右页边距后的 twip 宽度
     */
    public int contentWidthTwips() {
        // 业务上所有注音列共享同一正文宽度，防止不同段落因为拼音长度而左右漂移。
        return pageWidthTwips - horizontalMarginTwips * 2;
    }
}
