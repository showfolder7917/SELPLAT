package com.sp.selplat.japanese.n2bluebookquestion.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.japanese.common.util.codex.CodexCliUtil;
import com.sp.selplat.japanese.common.util.image.FfmpegImageUtil;
import com.sp.selplat.japanese.common.util.media.JapaneseMediaStorage;
import com.sp.selplat.japanese.common.util.media.JapaneseMediaType;
import com.sp.selplat.japanese.common.util.media.model.JapaneseMediaAsset;
import com.sp.selplat.japanese.common.util.speech.EdgeTtsSpeechUtil;
import com.sp.selplat.japanese.common.util.translation.DeepTranslatorUtil;
import com.sp.selplat.japanese.n2bluebookquestion.dao.JapaneseN2BlueBookQuestionDao;
import com.sp.selplat.japanese.n2bluebookquestion.service.JapaneseN2BlueBookQuestionService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;

/** 绑定 N2 蓝宝书题表 DAO，并维护本表的查询、默认字段和内容生成规则。 */
@Service
public class JapaneseN2BlueBookQuestionServiceImpl
        extends BaseServiceImpl<JapaneseN2BlueBookQuestionDao>
        implements JapaneseN2BlueBookQuestionService {

    /** 识别半角或全角的空白括号，保证发送给 NanamiNeural 的文本不保留题目占位符。 */
    private static final Pattern QUESTION_PLACEHOLDER_PATTERN = Pattern.compile(
            "(?:\\([\\s\\u3000]*\\)|（[\\s\\u3000]*）|"
                    + "\\[[\\s\\u3000]*\\]|［[\\s\\u3000]*］)");

    private final CodexCliUtil codexCliUtil;
    private final DeepTranslatorUtil deepTranslatorUtil;
    private final EdgeTtsSpeechUtil edgeTtsSpeechUtil;
    private final FfmpegImageUtil ffmpegImageUtil;
    private final JapaneseMediaStorage mediaStorage;

    /**
     * 注入分类后的翻译、Codex、语音、图片转换和媒体存储共通工具。
     * 真实传参示例：Spring 注入 {@code DeepTranslatorUtil}、{@code CodexCliUtil} 和语音工具。
     * 真实返回示例：构造后一个业务 Service 同时提供 CRUD 与三项内容生成能力。
     * 异常或副作用示例：任一工具缺失时 Spring 启动失败；构造不启动外部进程。
     *
     * @param codexCliUtil Codex 原图生成工具
     * @param deepTranslatorUtil 日语朗读文本免费翻译工具
     * @param edgeTtsSpeechUtil NanamiNeural 语音生成工具
     * @param ffmpegImageUtil WebP 图片转换工具
     * @param mediaStorage 当前本地或未来云存储实现
     */
    public JapaneseN2BlueBookQuestionServiceImpl(
            CodexCliUtil codexCliUtil,
            DeepTranslatorUtil deepTranslatorUtil,
            EdgeTtsSpeechUtil edgeTtsSpeechUtil,
            FfmpegImageUtil ffmpegImageUtil,
            JapaneseMediaStorage mediaStorage) {
        this.codexCliUtil = codexCliUtil;
        this.deepTranslatorUtil = deepTranslatorUtil;
        this.edgeTtsSpeechUtil = edgeTtsSpeechUtil;
        this.ffmpegImageUtil = ffmpegImageUtil;
        this.mediaStorage = mediaStorage;
    }

    /**
     * 查询当前题表的有效记录并保持稳定排序。
     * 真实传参示例：{@code {pageNo:1,pageSize:20,questionType:"GRAMMAR"}}。
     * 真实返回示例：返回 status=1 且按 sortnum、id 升序排列的题目分页结果。
     * 异常或副作用示例：数据库查询失败时沿用公共异常；只读题表，不修改数据。
     *
     * @param queryIn N2 题表分页和筛选条件
     * @return 当前有效题目的稳定分页结果
     */
    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        CommonPageParam value = queryIn == null
                ? new CommonPageParam() : queryIn;
        value.putParam("status", 1);
        return getDao().getPageList(
                value.getParamMap(),
                "sortnum asc id asc",
                value.getPageNo(),
                value.getPageSize());
    }

    /**
     * 补齐 N2 题目新增所需的平台默认字段并调用公共新增流程。
     * 真实传参示例：{@code {name:"第416题",questionText:"今年の大学新卒者…"}}。
     * 真实返回示例：返回含新主键、tenantId=1、status=1 和创建更新时间的题目。
     * 异常或副作用示例：数据库写入失败时抛出公共异常；成功后新增一条题目记录。
     *
     * @param saveIn 当前待新增的完整题目字段
     * @return 含生成主键和实际落库字段的公共结果
     */
    @Override
    public CommonResult insert(CommonParam saveIn) {
        LocalDateTime now = LocalDateTime.now();
        putIfAbsent(saveIn, "sortnum", 0);
        putIfAbsent(saveIn, "status", 1);
        putIfAbsent(saveIn, "createdAt", now);
        putIfAbsent(saveIn, "updatedAt", now);
        return super.insert(saveIn);
    }

    /**
     * 刷新 N2 题目的最后更新时间并调用公共更新流程。
     * 真实传参示例：{@code {id:100001,questionText:"修正后的题干"}}。
     * 真实返回示例：返回包含服务端当前 updatedAt 的更新字段。
     * 异常或副作用示例：主键无效或数据库失败时抛出公共异常；成功后更新对应题目。
     *
     * @param saveIn 题目主键和待更新字段
     * @return 含最终更新时间的公共更新结果
     */
    @Override
    public CommonResult update(CommonParam saveIn) {
        saveIn.putParam("updatedAt", LocalDateTime.now());
        return super.update(saveIn);
    }

    /**
     * 只在题目字段缺失时补入服务端默认值。
     * 真实传参示例：目标参数缺少 tenantId，字段名为 tenantId，默认值为 1L。
     * 真实返回示例：执行后参数包含 tenantId=1；已有 tenantId 时保持原值。
     * 异常或副作用示例：目标参数为空时调用方会产生空指针异常；本方法只修改当前参数映射。
     *
     * @param target 当前新增题目参数
     * @param key 默认字段名
     * @param value 缺失时写入的默认值
     */
    private void putIfAbsent(CommonParam target, String key, Object value) {
        if (target.getParam(key) == null) {
            target.putParam(key, value);
        }
    }

    /**
     * 调用 deep-translator 共通工具只把朗读文本翻译为简体中文。
     * 真实传参示例：{@code {audioText:"今年の給与は去年より低い。"}}。
     * 真实返回示例：{@code {success:true,data:{explanation:"今年的工资比去年低。"}}}。
     * 异常或副作用示例：朗读文本缺失时抛出业务异常，不启动翻译进程。
     *
     * @param request SELPLAT 公共单条请求参数
     * @return deep-translator 中文译文的公共结果
     */
    @Override
    public CommonResult generateExplanation(CommonParam request) {
        if (request == null || value(request, "audioText").isEmpty()) {
            throw new CommonBusinessException(
                    "JAPANESE_AUDIO_TEXT_REQUIRED", "请先填写朗读文本，再生成中文翻译。");
        }
        Path work = createWorkDirectory("explanation");
        try {
            String explanation = deepTranslatorUtil.translateToSimplifiedChinese(
                    value(request, "audioText"), work);
            return success(Map.of("explanation", explanation), "朗读文本中文翻译完成。");
        } finally {
            deleteWorkDirectory(work);
        }
    }

    /**
     * 调用 Codex 和 FFmpeg 共通工具生成并存储 WebP 图片。
     * 真实传参示例：{@code {questionText:"平均工资略低",correctOption:"D"}}。
     * 真实返回示例：{@code {success:true,data:{url:"/pic/x.webp"}}}。
     * 异常或副作用示例：生成失败时抛出系统异常且不写入题库表。
     *
     * @param request SELPLAT 公共单条请求参数
     * @return WebP 图片媒体的公共结果
     */
    @Override
    public CommonResult generateImage(CommonParam request) {
        validate(request);
        Path work = createWorkDirectory("image");
        try {
            Path rawImage = codexCliUtil.generateImage(request, work);
            Path webp = ffmpegImageUtil.convertToWebp(rawImage, work);
            JapaneseMediaAsset asset = mediaStorage.store(JapaneseMediaType.IMAGE, webp);
            return success(asset, "图片生成并压缩为 WebP 完成。");
        } finally {
            deleteWorkDirectory(work);
        }
    }

    /**
     * 调用 Edge TTS 共通工具生成并存储 NanamiNeural 语音。
     * 真实传参示例：{@code {audioText:"給与",correctOption:"D"}}。
     * 真实返回示例：{@code {success:true,data:{url:"/audio/x.mp3"}}}。
     * 异常或副作用示例：文本无效时抛出业务异常，不启动 edge-tts。
     *
     * @param request SELPLAT 公共单条请求参数
     * @return NanamiNeural 语音媒体的公共结果
     */
    @Override
    public CommonResult generateAudio(CommonParam request) {
        validate(request);
        // 已保存的完整朗读文本优先；仍含空格时按锁定答案现场补全后再交给语音工具。
        String audioText = resolveAudioText(request);
        Path work = createWorkDirectory("audio");
        try {
            Path audio = edgeTtsSpeechUtil.generate(audioText, work);
            JapaneseMediaAsset asset = mediaStorage.store(JapaneseMediaType.AUDIO, audio);
            return success(asset, "NanamiNeural 日语语音生成完成。");
        } finally {
            deleteWorkDirectory(work);
        }
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult playAudio(CommonParam request) {
        Object id = request == null ? null : request.getParam("id");
        if (id == null || String.valueOf(id).isBlank()) {
            throw new CommonBusinessException("JAPANESE_QUESTION_ID_REQUIRED", "题目主键不能为空。");
        }
        CommonParam query = new CommonParam();
        query.putParam("id", id);
        Object source = getById(query).getData();
        CommonParam question = new CommonParam();
        if (source instanceof Map<?, ?> map) {
            map.forEach((key, value) -> question.putParam(String.valueOf(key), value));
        }
        String existingUrl = value(question, "audioUrl");
        if (!existingUrl.isEmpty()) {
            return success(Map.of("url", existingUrl), "语音读取完成。");
        }
        CommonResult generated = generateAudio(question);
        if (!(generated.getData() instanceof JapaneseMediaAsset asset)) {
            throw new CommonSystemException(
                    "JAPANESE_AUDIO_RESULT_INVALID", "语音生成后未返回有效媒体对象。", null);
        }
        CommonParam update = new CommonParam();
        update.putParam("id", id);
        update.putParam("audioStorageProvider", asset.storageProvider());
        update.putParam("audioStorageKey", asset.objectKey());
        update.putParam("audioUrl", asset.url());
        this.update(update);
        return success(asset, "语音生成、保存并准备播放完成。");
    }

    /**
     * 将题干占位符替换为正确选项，生成不含括号的自然日语朗读文本。
     * 真实传参示例：{@code questionText=田中選手は…（　）するそうだ,correctOption=C,optionC=引退}。
     * 真实返回示例：{@code 田中選手は、全国大会が終わったら引退するそうだ。}。
     * 异常或副作用示例：两个空格却没有“やら／やら”式成对答案时抛业务异常；不启动 edge-tts。
     *
     * @param request 当前题干、四个选项、正确答案和可选朗读文本
     * @return 已填入正确答案且不含占位符的日语文本
     */
    private String resolveAudioText(CommonParam request) {
        String savedAudioText = value(request, "audioText");
        String sourceText = savedAudioText.isEmpty()
                ? value(request, "questionText") : savedAudioText;
        Matcher placeholderMatcher = QUESTION_PLACEHOLDER_PATTERN.matcher(sourceText);
        if (!placeholderMatcher.find()) {
            return sourceText;
        }

        String answerLetter = value(request, "correctOption").toUpperCase(Locale.ROOT);
        String answerText = value(request, "option" + answerLetter);
        if (answerText.isEmpty()) {
            throw new CommonBusinessException(
                    "JAPANESE_AUDIO_ANSWER_TEXT_REQUIRED", "正确答案对应的选项文字不能为空。");
        }

        long placeholderCount = QUESTION_PLACEHOLDER_PATTERN.matcher(sourceText).results().count();
        String[] answerParts = answerText.split("[/／]", -1);
        if (placeholderCount > 1 && answerParts.length != placeholderCount) {
            throw new CommonBusinessException(
                    "JAPANESE_AUDIO_PLACEHOLDER_MISMATCH", "多个朗读空格必须对应相同数量的答案片段。");
        }
        if (placeholderCount == 1) {
            return QUESTION_PLACEHOLDER_PATTERN.matcher(sourceText)
                    .replaceFirst(Matcher.quoteReplacement(answerText));
        }

        Matcher pairMatcher = QUESTION_PLACEHOLDER_PATTERN.matcher(sourceText);
        StringBuilder completedText = new StringBuilder();
        int answerIndex = 0;
        while (pairMatcher.find()) {
            // 两个题目空格依次接收“やら／やら”等答案片段，输出自然连续句子。
            pairMatcher.appendReplacement(
                    completedText,
                    Matcher.quoteReplacement(answerParts[answerIndex++].strip()));
        }
        pairMatcher.appendTail(completedText);
        return completedText.toString();
    }

    private void validate(CommonParam request) {
        if (request == null || value(request, "questionText").isEmpty()) {
            throw new CommonBusinessException("JAPANESE_QUESTION_TEXT_REQUIRED", "请先填写题干。");
        }
        String correctOption = value(request, "correctOption").toUpperCase(Locale.ROOT);
        if (!List.of("A", "B", "C", "D").contains(correctOption)) {
            throw new CommonBusinessException(
                    "JAPANESE_CORRECT_OPTION_REQUIRED", "请选择 A、B、C 或 D 作为正确答案。");
        }
    }

    private Path createWorkDirectory(String action) {
        try {
            return Files.createTempDirectory("japanese-codex-" + action + "-");
        } catch (IOException exception) {
            throw new CommonSystemException(
                    "JAPANESE_AI_TEMP_DIRECTORY_FAILED", "无法准备生成任务临时目录。", exception);
        }
    }

    private CommonResult success(Object data, String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg(message);
        return result;
    }

    /**
     * 从 SELPLAT 公共参数容器读取一个题目字段并统一转换为文本。
     * 真实传参示例：参数为 {@code {questionText:"給与"}}，字段名为 {@code questionText}。
     * 真实返回示例：返回 {@code "給与"}；字段不存在时返回空串。
     * 异常或副作用示例：参数为空时不抛出异常，不修改参数映射。
     *
     * @param request SELPLAT 公共单条请求参数
     * @param field 题目字段名
     * @return 去除首尾空格后的文本
     */
    private String value(CommonParam request, String field) {
        Object value = request == null ? null : request.getParam(field);
        return value == null ? "" : String.valueOf(value).strip();
    }

    private void deleteWorkDirectory(Path work) {
        if (work == null || !Files.isDirectory(work)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(work)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // 临时目录清理失败不覆盖已经返回的业务结果。
                }
            });
        } catch (IOException ignored) {
            // 系统临时目录由操作系统继续回收，不把清理异常暴露给题库页面。
        }
    }
}
