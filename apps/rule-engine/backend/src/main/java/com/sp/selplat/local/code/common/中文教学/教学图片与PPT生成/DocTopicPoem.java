package com.sp.selplat.local.code.common.中文教学.教学图片与PPT生成;

import java.util.List;

/**
 * 保存从核定版拼音 DOCX 中提取的一首作品及逐字注音。
 *
 * @param title 篇名
 * @param dynasty 朝代
 * @param author 作者或作品来源
 * @param lines 按原文顺序排列的注音行
 */
public record DocTopicPoem(String title, String dynasty, String author, List<AnnotatedLine> lines) {

    /**
     * 构造时固定全部集合，防止图片生成阶段修改核定原文顺序。
     */
    public DocTopicPoem {
        // 业务上标题和正文是图片命名及绘制的正式数据，任何空值都应在解析阶段暴露。
        if (title == null || title.isBlank() || lines == null || lines.isEmpty()) {
            throw new IllegalArgumentException("古诗标题和正文不能为空");
        }
        // 业务上朝代和作者允许无名作品使用空字符串，但不允许 null 传播到版式层。
        dynasty = dynasty == null ? "" : dynasty.strip();
        author = author == null ? "" : author.strip();
        // 业务上复制为不可变列表，保证图片批处理不会重排或删除核定行。
        lines = List.copyOf(lines);
    }

    /**
     * 一行逐字拼音及原文。
     *
     * @param tokens 逐字注音单元
     */
    public record AnnotatedLine(List<AnnotatedToken> tokens) {

        /**
         * 固定一行的逐字顺序。
         */
        public AnnotatedLine {
            // 业务上每个正文表格至少要包含一个汉字或标点，空表格不进入图片。
            if (tokens == null || tokens.isEmpty()) {
                throw new IllegalArgumentException("注音行不能为空");
            }
            // 业务上复制为不可变列表，保持拼音与汉字一一对应。
            tokens = List.copyOf(tokens);
        }

        /**
         * 拼接当前行原文，供日志、测试和无拼音辅助布局使用。
         *
         * @return 保持原顺序的汉字和标点
         */
        public String text() {
            // 业务上只拼接原文字段，不使用拼音反推汉字，避免引入二次转换误差。
            return tokens.stream().map(AnnotatedToken::text).reduce("", String::concat);
        }
    }

    /**
     * 单个核定原文字元与其上方拼音。
     *
     * @param pinyin 带调拼音，标点为空字符串
     * @param text 原汉字或标点
     */
    public record AnnotatedToken(String pinyin, String text) {

        /**
         * 清理 POI 读取产生的空值，同时禁止丢失原字符。
         */
        public AnnotatedToken {
            // 业务上标点允许没有拼音，因此只把 null 统一为空字符串。
            pinyin = pinyin == null ? "" : pinyin.strip();
            // 业务上原字符是核定内容，缺失时无法保证逐字对齐，必须立即失败。
            if (text == null || text.isEmpty()) {
                throw new IllegalArgumentException("注音单元缺少原字符");
            }
        }
    }
}
