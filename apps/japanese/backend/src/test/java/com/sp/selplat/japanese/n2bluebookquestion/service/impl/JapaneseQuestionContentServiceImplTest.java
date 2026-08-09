package com.sp.selplat.japanese.n2bluebookquestion.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.japanese.media.impl.LocalJapaneseMediaStorage;
import com.sp.selplat.japanese.media.model.JapaneseMediaAsset;
import com.sp.selplat.japanese.runtime.JapaneseExternalProcessRunner;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** 使用假的外部进程验证 Codex、WebP、NanamiNeural 和媒体存储编排，不触发真实模型。 */
class JapaneseQuestionContentServiceImplTest {

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
    void shouldGenerateExplanationWebpAndNanamiAudioWithoutRealCodex() throws Exception {
        Files.createDirectories(projectRoot.resolve("apps/japanese"));
        Clock clock = Clock.fixed(Instant.parse("2026-08-09T12:00:00Z"), ZoneOffset.UTC);
        JapaneseQuestionContentServiceImpl service = new JapaneseQuestionContentServiceImpl(
                fakeProcessRunner(), new LocalJapaneseMediaStorage(projectRoot, clock),
                "/fake/codex", "/fake/edge-tts", "/fake/ffmpeg");
        CommonParam request = validRequest();

        CommonResult explanation = service.generateExplanation(request);
        CommonResult image = service.generateImage(request);
        CommonResult audio = service.generateAudio(request);

        assertThat(explanation.isSuccess()).isTrue();
        assertThat(((Map<?, ?>) explanation.getData()).get("explanation"))
                .isEqualTo("給与读作きゅうよ，正确答案是 D。");
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
     * 验证答案缺失时在启动 Codex 或 edge-tts 前直接返回业务错误。
     * 真实传参示例：correctOption 为空的完整题目。
     * 真实返回示例：异常编码 {@code JAPANESE_CORRECT_OPTION_REQUIRED}。
     * 异常或副作用示例：进程计数保持零且临时 static 下没有媒体文件。
     */
    @Test
    void shouldRejectMissingCorrectOptionBeforeStartingExternalProcess() {
        AtomicInteger processCount = new AtomicInteger();
        JapaneseExternalProcessRunner runner = (command, work, timeout) -> processCount.incrementAndGet();
        JapaneseQuestionContentServiceImpl service = new JapaneseQuestionContentServiceImpl(
                runner,
                new LocalJapaneseMediaStorage(projectRoot, Clock.systemUTC()),
                "/fake/codex", "/fake/edge-tts", "/fake/ffmpeg");
        CommonParam invalid = request(
                "PRONUNCIATION", "給与", "A", "B", "C", "D", "", "給与");

        assertThatThrownBy(() -> service.generateExplanation(invalid))
                .isInstanceOf(CommonBusinessException.class)
                .extracting(error -> ((CommonBusinessException) error).getErrorCode())
                .isEqualTo("JAPANESE_CORRECT_OPTION_REQUIRED");
        assertThat(processCount).hasValue(0);
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
                if (executable.endsWith("codex")) {
                    int outputIndex = command.indexOf("-o") + 1;
                    if (command.contains("workspace-write")) {
                        Files.write(workingDirectory.resolve("generated-image.png"), new byte[]{1, 2, 3});
                        Files.writeString(Path.of(command.get(outputIndex)), "generated-image.png");
                    } else {
                        Files.writeString(Path.of(command.get(outputIndex)), "給与读作きゅうよ，正确答案是 D。");
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
}
