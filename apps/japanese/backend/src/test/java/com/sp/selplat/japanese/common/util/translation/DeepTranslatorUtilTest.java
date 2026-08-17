package com.sp.selplat.japanese.common.util.translation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.japanese.common.util.process.JapaneseExternalProcessRunner;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** 验证 deep-translator 命令边界、译文提取和空结果保护，不调用真实 Google 服务。 */
class DeepTranslatorUtilTest {

    @TempDir
    private Path work;

    /**
     * 验证日语朗读文本作为独立参数发送，并从命令诊断输出中提取简体中文。
     * 真实传参示例：{@code 今年の給与は去年より低い。}。
     * 真实返回示例：返回 {@code 今年的工资比去年低。} 且命令目标为 {@code zh-CN}。
     * 异常或副作用示例：假进程只写临时日志，不访问 Google 或工程数据库。
     *
     * @throws Exception 假进程写入临时输出失败时终止测试
     */
    @Test
    void shouldTranslateJapaneseAudioTextAndStripCliDiagnostics() throws Exception {
        AtomicReference<List<String>> commandRef = new AtomicReference<>();
        JapaneseExternalProcessRunner runner = (command, directory, timeout) -> {
            try {
                commandRef.set(command);
                Files.writeString(
                        directory.resolve("process-output.log"),
                        "Translation from ja to zh-CN\n"
                                + "--------------------------------------------------\n"
                                + "Translation result: 今年的工资比去年低。\n");
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        };
        DeepTranslatorUtil translator = new DeepTranslatorUtil(runner, "/fake/deep-translator");

        String result = translator.translateToSimplifiedChinese(
                "今年の給与は去年より低い。", work);

        assertThat(result).isEqualTo("今年的工资比去年低。");
        assertThat(commandRef.get()).containsExactly(
                "/fake/deep-translator",
                "--translator", "google",
                "--source", "ja",
                "--target", "zh-CN",
                "--text", "今年の給与は去年より低い。");
    }

    /**
     * 验证外部进程成功退出但未提供译文时仍返回稳定系统错误。
     * 真实传参示例：CLI 日志只包含语言方向，不包含 {@code Translation result:}。
     * 真实返回示例：异常编码为 {@code JAPANESE_TRANSLATION_OUTPUT_MISSING}。
     * 异常或副作用示例：不会把诊断文本当成题目解释，也不产生数据库写入。
     */
    @Test
    void shouldRejectMissingTranslationResult() {
        JapaneseExternalProcessRunner runner = (command, directory, timeout) -> {
            try {
                Files.writeString(directory.resolve("process-output.log"), "Translation from ja to zh-CN\n");
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        };
        DeepTranslatorUtil translator = new DeepTranslatorUtil(runner, "/fake/deep-translator");

        assertThatThrownBy(() -> translator.translateToSimplifiedChinese("給与", work))
                .isInstanceOf(CommonSystemException.class)
                .extracting(error -> ((CommonSystemException) error).getErrorCode())
                .isEqualTo("JAPANESE_TRANSLATION_OUTPUT_MISSING");
    }
}
