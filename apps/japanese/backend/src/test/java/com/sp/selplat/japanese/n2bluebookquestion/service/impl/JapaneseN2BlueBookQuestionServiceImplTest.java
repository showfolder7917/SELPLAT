package com.sp.selplat.japanese.n2bluebookquestion.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.japanese.common.util.codex.CodexCliUtil;
import com.sp.selplat.japanese.common.util.image.FfmpegImageUtil;
import com.sp.selplat.japanese.common.util.media.impl.LocalJapaneseMediaStorage;
import com.sp.selplat.japanese.common.util.media.model.JapaneseMediaAsset;
import com.sp.selplat.japanese.common.util.process.JapaneseExternalProcessRunner;
import com.sp.selplat.japanese.common.util.speech.EdgeTtsSpeechUtil;
import com.sp.selplat.japanese.common.util.translation.DeepTranslatorUtil;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** 使用假的外部进程验证翻译、Codex、WebP、NanamiNeural 和媒体编排，不触发在线服务。 */
class JapaneseN2BlueBookQuestionServiceImplTest {

    @TempDir
    private Path projectRoot;

    /**
     * 验证三个按钮分别返回解释、WebP 图片和 MP3 语音的稳定结构。
     * 真实传参示例：N2 第416题与正确答案 D。
     * 真实返回示例：解释正文、{@code /pic/*.webp} 和 {@code /audio/*.mp3}。
     * 异常或副作用示例：只在 JUnit 临时 japanese/static 目录写两个媒体文件。
     *
     * @throws Exception 假进程准备输出文件失败时终止测试
     */
    @Test
    void shouldGenerateExplanationWebpAndNanamiAudioWithoutRealOnlineService() throws Exception {
        Files.createDirectories(projectRoot.resolve("apps/japanese"));
        Clock clock = Clock.fixed(Instant.parse("2026-08-09T12:00:00Z"), ZoneOffset.UTC);
        JapaneseExternalProcessRunner runner = fakeProcessRunner();
        JapaneseN2BlueBookQuestionServiceImpl service = service(
                runner, new LocalJapaneseMediaStorage(projectRoot, clock));
        CommonParam request = validRequest();

        CommonResult explanation = service.generateExplanation(request);
        CommonResult image = service.generateImage(request);
        CommonResult audio = service.generateAudio(request);

        assertThat(explanation.isSuccess()).isTrue();
        assertThat(((Map<?, ?>) explanation.getData()).get("explanation"))
                .isEqualTo("今年的大学应届毕业生平均工资比去年略低。");
        JapaneseMediaAsset imageAsset = (JapaneseMediaAsset) image.getData();
        JapaneseMediaAsset audioAsset = (JapaneseMediaAsset) audio.getData();
        assertThat(imageAsset.url()).startsWith("/pic/").endsWith(".webp");
        assertThat(imageAsset.contentType()).isEqualTo("image/webp");
        assertThat(audioAsset.url()).startsWith("/audio/").endsWith(".mp3");
        assertThat(audioAsset.contentType()).isEqualTo("audio/mpeg");
        assertThat(projectRoot.resolve("apps/japanese/backend/src/main/resources/static")
                .resolve(imageAsset.objectKey())).isRegularFile();
        assertThat(projectRoot.resolve("apps/japanese/backend/src/main/resources/static")
                .resolve(audioAsset.objectKey())).isRegularFile();
    }

    /**
     * 验证图片所需答案缺失时在启动 Codex 前直接返回业务错误。
     * 真实传参示例：correctOption 为空的完整题目。
     * 真实返回示例：异常编码 {@code JAPANESE_CORRECT_OPTION_REQUIRED}。
     * 异常或副作用示例：进程计数保持零且临时 static 下没有媒体文件。
     */
    @Test
    void shouldRejectMissingCorrectOptionBeforeStartingImageProcess() {
        AtomicInteger processCount = new AtomicInteger();
        JapaneseExternalProcessRunner runner = (command, work, timeout) -> processCount.incrementAndGet();
        JapaneseN2BlueBookQuestionServiceImpl service = service(
                runner, new LocalJapaneseMediaStorage(projectRoot, Clock.systemUTC()));
        CommonParam invalid = request(
                "PRONUNCIATION", "給与", "A", "B", "C", "D", "", "給与");

        assertThatThrownBy(() -> service.generateImage(invalid))
                .isInstanceOf(CommonBusinessException.class)
                .extracting(error -> ((CommonBusinessException) error).getErrorCode())
                .isEqualTo("JAPANESE_CORRECT_OPTION_REQUIRED");
        assertThat(processCount).hasValue(0);
    }

    /**
     * 验证中文翻译只把朗读文本交给 deep-translator，不泄漏题干、选项或答案。
     * 真实传参示例：朗读文本为“給与は去年より低い。”，题干为完全不同的“不得进入提示词”。
     * 真实返回示例：命令只含日语朗读文本和 ja、zh-CN，并返回“工资比去年低。”。
     * 异常或副作用示例：只由假进程写临时命令输出，不调用真实 Google 翻译。
     */
    @Test
    void shouldTranslateOnlyAudioTextWithoutQuestionContext() {
        AtomicReference<List<String>> translationCommand = new AtomicReference<>();
        JapaneseExternalProcessRunner runner = (command, workingDirectory, timeout) -> {
            try {
                translationCommand.set(command);
                Files.writeString(
                        workingDirectory.resolve("process-output.log"),
                        "Translation from ja to zh-CN\n"
                                + "--------------------------------------------------\n"
                                + "Translation result: 工资比去年低。\n");
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        };
        JapaneseN2BlueBookQuestionServiceImpl service = service(
                runner, new LocalJapaneseMediaStorage(projectRoot, Clock.systemUTC()));
        CommonParam request = request(
                "GRAMMAR", "不得进入提示词", "甲", "乙", "丙", "丁", "D", "給与は去年より低い。");

        CommonResult result = service.generateExplanation(request);

        assertThat(translationCommand.get()).containsExactly(
                "/fake/deep-translator",
                "--translator", "google",
                "--source", "ja",
                "--target", "zh-CN",
                "--text", "給与は去年より低い。");
        assertThat(String.join(" ", translationCommand.get()))
                .doesNotContain("不得进入提示词", "甲", "乙", "丙", "丁");
        assertThat(((Map<?, ?>) result.getData()).get("explanation")).isEqualTo("工资比去年低。");
    }

    /**
     * 验证朗读字段为空时由服务把正确选项填进题干，而不是把括号交给 NanamiNeural。
     * 真实传参示例：第003题题干空格、C=引退且 audioText 为空。
     * 真实返回示例：edge-tts 的 {@code --text} 参数为“田中選手は…引退するそうだ。”。
     * 异常或副作用示例：只由假进程写一份 MP3，不调用真实语音服务。
     */
    @Test
    void shouldFillCorrectOptionIntoAudioTextBeforeNanamiGeneration() {
        AtomicReference<String> spokenText = new AtomicReference<>();
        JapaneseExternalProcessRunner runner = (command, workingDirectory, timeout) -> {
            try {
                if (command.get(0).endsWith("edge-tts")) {
                    spokenText.set(command.get(command.indexOf("--text") + 1));
                    Files.write(
                            Path.of(command.get(command.indexOf("--write-media") + 1)),
                            new byte[]{7, 8, 9});
                }
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        };
        JapaneseN2BlueBookQuestionServiceImpl service = service(
                runner, new LocalJapaneseMediaStorage(projectRoot, Clock.systemUTC()));
        CommonParam request = request(
                "KANJI",
                "田中選手は、全国大会が終わったら（　）するそうだ。",
                "移動", "完了", "引退", "失業", "C", "");

        service.generateAudio(request);

        assertThat(spokenText).hasValue("田中選手は、全国大会が終わったら引退するそうだ。");
    }

    private CommonParam validRequest() {
        return request(
                "PRONUNCIATION",
                "今年の大学新卒者の平均給与は去年よりやや低い。",
                "きゅうりょう", "きょうきゅう", "きゅうよう", "きゅうよ", "D", "給与");
    }

    /**
     * 使用 SELPLAT 公共单条参数构造一道题的内容生成输入。
     * 真实传参示例：题干 {@code 給与}、正确答案 {@code D}和朗读文本 {@code 給与}。
     * 真实返回示例：{@code paramMap={questionText:給与,correctOption:D}}。
     * 异常或副作用示例：空字段保留给被测服务校验，本方法不启动外部进程。
     *
     * @param questionType 题型
     * @param questionText 题干
     * @param optionA 选项 A
     * @param optionB 选项 B
     * @param optionC 选项 C
     * @param optionD 选项 D
     * @param correctOption 正确答案
     * @param audioText 朗读文本
     * @return SELPLAT 公共单条请求参数
     */
    private CommonParam request(
            String questionType,
            String questionText,
            String optionA,
            String optionB,
            String optionC,
            String optionD,
            String correctOption,
            String audioText) {
        CommonParam request = new CommonParam();
        request.putParam("questionType", questionType);
        request.putParam("questionText", questionText);
        request.putParam("optionA", optionA);
        request.putParam("optionB", optionB);
        request.putParam("optionC", optionC);
        request.putParam("optionD", optionD);
        request.putParam("correctOption", correctOption);
        request.putParam("audioText", audioText);
        return request;
    }

    private JapaneseExternalProcessRunner fakeProcessRunner() {
        return (command, workingDirectory, timeout) -> {
            try {
                String executable = command.get(0);
                if (executable.endsWith("deep-translator")) {
                    Files.writeString(
                            workingDirectory.resolve("process-output.log"),
                            "Translation from ja to zh-CN\n"
                                    + "--------------------------------------------------\n"
                                    + "Translation result: 今年的大学应届毕业生平均工资比去年略低。\n");
                    return;
                }
                if (executable.endsWith("codex")) {
                    int outputIndex = command.indexOf("-o") + 1;
                    if (command.contains("workspace-write")) {
                        Files.write(workingDirectory.resolve("generated-image.png"), new byte[]{1, 2, 3});
                        Files.writeString(Path.of(command.get(outputIndex)), "generated-image.png");
                    } else {
                        Files.writeString(
                                Path.of(command.get(outputIndex)),
                                "今年的大学应届毕业生平均工资比去年略低。");
                    }
                    return;
                }
                if (executable.endsWith("ffmpeg")) {
                    Files.write(Path.of(command.get(command.size() - 1)), new byte[]{4, 5, 6});
                    return;
                }
                int mediaIndex = command.indexOf("--write-media") + 1;
                Files.write(Path.of(command.get(mediaIndex)), new byte[]{7, 8, 9});
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        };
    }

    /**
     * 使用同一个假进程边界装配翻译、Codex、语音和图片共通工具。
     * 真实传参示例：假进程执行器和写入 JUnit 临时目录的媒体存储。
     * 真实返回示例：返回不会启动真实翻译、Codex、edge-tts 或 FFmpeg 的业务服务。
     * 异常或副作用示例：仅调用业务方法时才由假进程写测试文件；装配本身无副作用。
     *
     * @param runner 假外部进程执行器
     * @param storage JUnit 临时媒体存储
     * @return 完整的题目内容生成服务
     */
    private JapaneseN2BlueBookQuestionServiceImpl service(
            JapaneseExternalProcessRunner runner,
            LocalJapaneseMediaStorage storage) {
        return new JapaneseN2BlueBookQuestionServiceImpl(
                new CodexCliUtil(runner, "/fake/codex"),
                new DeepTranslatorUtil(runner, "/fake/deep-translator"),
                new EdgeTtsSpeechUtil(runner, "/fake/edge-tts"),
                new FfmpegImageUtil(runner, "/fake/ffmpeg"),
                storage);
    }
}
