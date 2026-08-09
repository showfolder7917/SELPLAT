package com.sp.selplat.japanese.n2bluebookquestion.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.japanese.media.JapaneseMediaStorage;
import com.sp.selplat.japanese.media.JapaneseMediaType;
import com.sp.selplat.japanese.media.model.JapaneseMediaAsset;
import com.sp.selplat.japanese.n2bluebookquestion.service.JapaneseQuestionContentService;
import com.sp.selplat.japanese.runtime.JapaneseExternalProcessRunner;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 使用本机 Codex CLI 生成解释和原图，使用指定 edge-tts NanamiNeural 生成语音。
 * 所有原始产物先进入系统临时目录，只有最终 WebP 或 MP3 交给媒体存储接口。
 */
@Service
public class JapaneseQuestionContentServiceImpl implements JapaneseQuestionContentService {

    private static final Duration CODEX_TIMEOUT = Duration.ofMinutes(8);
    private static final Duration MEDIA_TIMEOUT = Duration.ofMinutes(3);
    private final JapaneseExternalProcessRunner processRunner;
    private final JapaneseMediaStorage mediaStorage;
    private final String codexExecutable;
    private final String edgeTtsExecutable;
    private final String ffmpegExecutable;

    /**
     * 装配当前机器已经确认的 Codex、edge-tts 和 FFmpeg 路径。
     * 真实传参示例：Codex 桌面内置 CLI、指定 edge-tts venv 与 {@code /opt/homebrew/bin/ffmpeg}。
     * 真实返回示例：构造后按钮调用直接进入对应本机进程。
     * 异常或副作用示例：路径不可执行时点击按钮返回系统错误；构造不启动任何进程。
     *
     * @param processRunner 统一外部进程边界
     * @param mediaStorage 当前本地或未来云存储实现
     * @param codexExecutable Codex CLI 路径
     * @param edgeTtsExecutable edge-tts 路径
     * @param ffmpegExecutable FFmpeg 路径
     */
    public JapaneseQuestionContentServiceImpl(
            JapaneseExternalProcessRunner processRunner,
            JapaneseMediaStorage mediaStorage,
            @Value("${japanese.ai.codex.executable}") String codexExecutable,
            @Value("${japanese.ai.edge-tts.executable}") String edgeTtsExecutable,
            @Value("${japanese.ai.ffmpeg.executable}") String ffmpegExecutable) {
        this.processRunner = processRunner;
        this.mediaStorage = mediaStorage;
        this.codexExecutable = codexExecutable;
        this.edgeTtsExecutable = edgeTtsExecutable;
        this.ffmpegExecutable = ffmpegExecutable;
    }

    /**
     * 调用本机 Codex CLI 直接生成面向中文学习者的日语题目解释。
     * 真实传参示例：給与读音题、四个假名选项和正确答案 D。
     * 真实返回示例：{@code {success:true,data:{explanation:"給与读作きゅうよ……"}}}。
     * 异常或副作用示例：题干或答案缺失时不启动 Codex；生成过程只写系统临时目录。
     *
     * @param request 当前编辑窗口完整题目上下文
     * @return 含解释正文的公共成功结果
     */
    @Override
    public CommonResult generateExplanation(CommonParam request) {
        validate(request);
        Path work = createWorkDirectory("explanation");
        try {
            Path finalMessage = work.resolve("explanation.txt");
            List<String> command = codexCommand(
                    work, "read-only", false, finalMessage, explanationPrompt(request));
            processRunner.run(command, work, CODEX_TIMEOUT);
            String explanation = readRequired(finalMessage, "Codex 未返回解释内容。");
            return success(Map.of("explanation", explanation), "解释生成完成。");
        } finally {
            deleteWorkDirectory(work);
        }
    }

    /**
     * 调用本机 Codex CLI 生成无文字题意插图，再由 FFmpeg 压缩为 WebP。
     * 真实传参示例：包含“今年平均工资略低”的题干与正确答案。
     * 真实返回示例：{@code {url:"/pic/n2-blue-book-question-1.webp",contentType:"image/webp"}}。
     * 异常或副作用示例：Codex 没有产生图片时不写 static；成功后新增一张 WebP。
     *
     * @param request 当前编辑窗口完整题目上下文
     * @return 含媒体访问地址和对象键的公共成功结果
     */
    @Override
    public CommonResult generateImage(CommonParam request) {
        validate(request);
        Path work = createWorkDirectory("image");
        try {
            Path finalMessage = work.resolve("image-result.txt");
            Path requestedImage = work.resolve("generated-image.png");
            List<String> command = codexCommand(
                    work, "workspace-write", true, finalMessage,
                    imagePrompt(request, requestedImage));
            processRunner.run(command, work, CODEX_TIMEOUT);
            Path rawImage = findGeneratedImage(work, requestedImage);
            Path webp = work.resolve("generated-image.webp");
            processRunner.run(List.of(
                    ffmpegExecutable, "-y", "-i", rawImage.toString(),
                    "-c:v", "libwebp", "-quality", "82", webp.toString()),
                    work, MEDIA_TIMEOUT);
            JapaneseMediaAsset asset = mediaStorage.store(JapaneseMediaType.IMAGE, webp);
            return success(asset, "图片生成并压缩为 WebP 完成。");
        } finally {
            deleteWorkDirectory(work);
        }
    }

    /**
     * 使用指定 edge-tts venv 的 NanamiNeural 直接生成日语语音。
     * 真实传参示例：audioText 为 {@code 今年の大学新卒者の平均給与は去年よりやや低い。}。
     * 真实返回示例：{@code {url:"/audio/n2-blue-book-question-1.mp3",contentType:"audio/mpeg"}}。
     * 异常或副作用示例：文本为空时不启动 edge-tts；成功后新增一个 MP3。
     *
     * @param request 当前编辑窗口题目和可选朗读文本
     * @return 含语音访问地址和对象键的公共成功结果
     */
    @Override
    public CommonResult generateAudio(CommonParam request) {
        validate(request);
        String audioText = value(request, "audioText").isEmpty()
                ? value(request, "questionText") : value(request, "audioText");
        Path work = createWorkDirectory("audio");
        try {
            Path audio = work.resolve("generated-audio.mp3");
            processRunner.run(List.of(
                    edgeTtsExecutable,
                    "--voice", "ja-JP-NanamiNeural",
                    "--text", audioText,
                    "--write-media", audio.toString()), work, MEDIA_TIMEOUT);
            JapaneseMediaAsset asset = mediaStorage.store(JapaneseMediaType.AUDIO, audio);
            return success(asset, "NanamiNeural 日语语音生成完成。");
        } finally {
            deleteWorkDirectory(work);
        }
    }

    private List<String> codexCommand(
            Path work,
            String sandbox,
            boolean approveForMe,
            Path finalMessage,
            String prompt) {
        List<String> command = new ArrayList<>(List.of(
                codexExecutable, "exec", "--ephemeral", "--ignore-rules",
                "--skip-git-repo-check", "-C", work.toString(),
                "--sandbox", sandbox, "-o", finalMessage.toString()));
        if (approveForMe) {
            command.add("--approve-for-me");
        }
        command.add(prompt);
        return command;
    }

    private String explanationPrompt(CommonParam request) {
        return "你是日语能力考试 N2 教师。请直接用简体中文解释下面选择题，必须说明正确答案、关键读音或语法、"
                + "其他选项为什么不对，并给出一句自然日语例句。不要修改文件，不要请求确认，只输出最终解释正文。\n"
                + questionContext(request);
    }

    private String imagePrompt(CommonParam request, Path output) {
        return "使用当前可用的图片生成能力，为下面这道日语 N2 题生成一张清晰、真实、适合学习卡片的横版语义插图。"
                + "图片中不得出现文字、字母、选项、答案或水印。将最终原图保存到绝对路径 " + output + "。"
                + "不要修改任何工程文件，不要请求确认。完成后只回复最终图片路径。\n"
                + questionContext(request);
    }

    private String questionContext(CommonParam request) {
        return "题型：" + value(request, "questionType")
                + "\n题干：" + value(request, "questionText")
                + "\nA：" + value(request, "optionA") + "\nB：" + value(request, "optionB")
                + "\nC：" + value(request, "optionC") + "\nD：" + value(request, "optionD")
                + "\n正确答案：" + value(request, "correctOption");
    }

    private void validate(CommonParam request) {
        if (request == null || value(request, "questionText").isEmpty()) {
            throw new CommonBusinessException("JAPANESE_QUESTION_TEXT_REQUIRED", "请先填写题干。");
        }
        String correctOption = value(request, "correctOption").toUpperCase(Locale.ROOT);
        if (!List.of("A", "B", "C", "D").contains(correctOption)) {
            throw new CommonBusinessException("JAPANESE_CORRECT_OPTION_REQUIRED", "请选择 A、B、C 或 D 作为正确答案。");
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

    private String readRequired(Path path, String message) {
        try {
            if (!Files.isRegularFile(path)) {
                throw new IOException(message);
            }
            String value = Files.readString(path).strip();
            if (value.isEmpty()) {
                throw new IOException(message);
            }
            return value;
        } catch (IOException exception) {
            throw new CommonSystemException("JAPANESE_CODEX_OUTPUT_MISSING", message, exception);
        }
    }

    private Path findGeneratedImage(Path work, Path requestedImage) {
        if (isNonEmptyFile(requestedImage)) {
            return requestedImage;
        }
        try (Stream<Path> files = Files.list(work)) {
            return files.filter(this::isNonEmptyFile)
                    .filter(path -> {
                        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
                        return name.endsWith(".png") || name.endsWith(".jpg")
                                || name.endsWith(".jpeg") || name.endsWith(".webp");
                    })
                    .findFirst()
                    .orElseThrow(() -> new IOException("Codex 未生成图片文件。"));
        } catch (IOException exception) {
            throw new CommonSystemException(
                    "JAPANESE_CODEX_IMAGE_MISSING", "Codex 没有返回可用图片。", exception);
        }
    }

    private boolean isNonEmptyFile(Path path) {
        try {
            return Files.isRegularFile(path) && Files.size(path) > 0L;
        } catch (IOException exception) {
            return false;
        }
    }

    private CommonResult success(Object data, String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg(message);
        return result;
    }

    private String text(String value) {
        return value == null ? "" : value.strip();
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
        return text(value == null ? null : String.valueOf(value));
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
