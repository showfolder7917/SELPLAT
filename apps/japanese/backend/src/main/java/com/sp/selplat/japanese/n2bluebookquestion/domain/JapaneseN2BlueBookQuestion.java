package com.sp.selplat.japanese.n2bluebookquestion.domain;

import com.sp.selplat.common.util.Domain;

/** 承接 N2 蓝宝书1000题的题干、四项选择、答案、AI 解释和媒体访问字段。 */
public class JapaneseN2BlueBookQuestion extends Domain {

    private String name;
    private String jlptLevel;
    private String sourceBook;
    private Integer sourceQuestionNo;
    private String questionType;
    private String questionText;
    private String optionA;
    private String optionB;
    private String optionC;
    private String optionD;
    private String correctOption;
    private String explanation;
    private String audioText;
    private String imageStorageProvider;
    private String imageStorageKey;
    private String imageUrl;
    private String audioStorageProvider;
    private String audioStorageKey;
    private String audioUrl;

    /** @return 题目标题，例如 {@code 蓝宝书 N2 第416题}。 */
    public String getName() { return name; }

    /** @param name 题目标题，例如 {@code 蓝宝书 N2 第416题}。 */
    public void setName(String name) { this.name = name; }

    /** @return JLPT 等级，例如 {@code N2}。 */
    public String getJlptLevel() { return jlptLevel; }

    /** @param jlptLevel JLPT 等级，例如 {@code N2}。 */
    public void setJlptLevel(String jlptLevel) { this.jlptLevel = jlptLevel; }

    /** @return 题库来源，例如 {@code 蓝宝书1000题}。 */
    public String getSourceBook() { return sourceBook; }

    /** @param sourceBook 题库来源，例如 {@code 蓝宝书1000题}。 */
    public void setSourceBook(String sourceBook) { this.sourceBook = sourceBook; }

    /** @return 来源题号，例如 {@code 416}。 */
    public Integer getSourceQuestionNo() { return sourceQuestionNo; }

    /** @param sourceQuestionNo 来源题号，例如 {@code 416}。 */
    public void setSourceQuestionNo(Integer sourceQuestionNo) { this.sourceQuestionNo = sourceQuestionNo; }

    /** @return 题型，例如 {@code PRONUNCIATION}、{@code KANJI} 或 {@code GRAMMAR}。 */
    public String getQuestionType() { return questionType; }

    /** @param questionType 题型，例如 {@code GRAMMAR}。 */
    public void setQuestionType(String questionType) { this.questionType = questionType; }

    /** @return 日语题干，例如 {@code 今年の大学新卒者の平均給与は去年よりやや低い。}。 */
    public String getQuestionText() { return questionText; }

    /** @param questionText 日语题干。 */
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    /** @return A 选项，例如 {@code きゅうりょう}。 */
    public String getOptionA() { return optionA; }

    /** @param optionA A 选项。 */
    public void setOptionA(String optionA) { this.optionA = optionA; }

    /** @return B 选项，例如 {@code きょうきゅう}。 */
    public String getOptionB() { return optionB; }

    /** @param optionB B 选项。 */
    public void setOptionB(String optionB) { this.optionB = optionB; }

    /** @return C 选项，例如 {@code きゅうよう}。 */
    public String getOptionC() { return optionC; }

    /** @param optionC C 选项。 */
    public void setOptionC(String optionC) { this.optionC = optionC; }

    /** @return D 选项，例如 {@code きゅうよ}。 */
    public String getOptionD() { return optionD; }

    /** @param optionD D 选项。 */
    public void setOptionD(String optionD) { this.optionD = optionD; }

    /** @return 正确选项，例如 {@code D}。 */
    public String getCorrectOption() { return correctOption; }

    /** @param correctOption 正确选项，只允许 A 至 D。 */
    public void setCorrectOption(String correctOption) { this.correctOption = correctOption; }

    /** @return Codex 生成或人工修订的中文解释。 */
    public String getExplanation() { return explanation; }

    /** @param explanation 中文解释。 */
    public void setExplanation(String explanation) { this.explanation = explanation; }

    /** @return 交给 NanamiNeural 的日语文本；为空时使用题干。 */
    public String getAudioText() { return audioText; }

    /** @param audioText 需要朗读的日语文本。 */
    public void setAudioText(String audioText) { this.audioText = audioText; }

    /** @return 图片存储提供方，例如 {@code local}。 */
    public String getImageStorageProvider() { return imageStorageProvider; }

    /** @param imageStorageProvider 图片存储提供方。 */
    public void setImageStorageProvider(String imageStorageProvider) { this.imageStorageProvider = imageStorageProvider; }

    /** @return 图片对象键，例如 {@code pic/n2-blue-book-question-x.webp}。 */
    public String getImageStorageKey() { return imageStorageKey; }

    /** @param imageStorageKey 图片对象键。 */
    public void setImageStorageKey(String imageStorageKey) { this.imageStorageKey = imageStorageKey; }

    /** @return 图片访问地址，例如 {@code /pic/n2-blue-book-question-x.webp}。 */
    public String getImageUrl() { return imageUrl; }

    /** @param imageUrl 图片访问地址。 */
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    /** @return 语音存储提供方，例如 {@code local}。 */
    public String getAudioStorageProvider() { return audioStorageProvider; }

    /** @param audioStorageProvider 语音存储提供方。 */
    public void setAudioStorageProvider(String audioStorageProvider) { this.audioStorageProvider = audioStorageProvider; }

    /** @return 语音对象键，例如 {@code audio/n2-blue-book-question-x.mp3}。 */
    public String getAudioStorageKey() { return audioStorageKey; }

    /** @param audioStorageKey 语音对象键。 */
    public void setAudioStorageKey(String audioStorageKey) { this.audioStorageKey = audioStorageKey; }

    /** @return 语音访问地址，例如 {@code /audio/n2-blue-book-question-x.mp3}。 */
    public String getAudioUrl() { return audioUrl; }

    /** @param audioUrl 语音访问地址。 */
    public void setAudioUrl(String audioUrl) { this.audioUrl = audioUrl; }
}
