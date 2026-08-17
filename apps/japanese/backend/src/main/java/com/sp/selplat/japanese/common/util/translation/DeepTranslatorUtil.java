package com.sp.selplat.japanese.common.util.translation;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.japanese.common.util.process.JapaneseExternalProcessRunner;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 封装 deep-translator 日译中命令，只返回朗读文本的简体中文译文。 */
@Component
public class DeepTranslatorUtil {

    /** 免费在线翻译应快速返回，超时后交由页面显示统一失败反馈。 */
    private static final Duration TRANSLATION_TIMEOUT = Duration.ofSeconds(45);
    /** deep-translator CLI 在诊断信息之后输出译文所使用的稳定标记。 */
    private static final String TRANSLATION_RESULT_MARKER = "Translation result:";

    private final JapaneseExternalProcessRunner processRunner;
    private final String deepTranslatorExecutable;

    /**
     * 装配统一外部进程边界与 deep-translator 插件路径。
     * 真实传参示例：假的进程执行器和 {@code /fake/deep-translator}。
     * 真实返回示例：构造后可把日语朗读文本交给 Google 免费翻译提供方。
     * 异常或副作用示例：路径不可执行时首次翻译抛出系统异常；构造不启动进程。
     *
     * @param processRunner 不经过 Shell 的外部进程执行器
     * @param deepTranslatorExecutable deep-translator 可执行路径
     */
    public DeepTranslatorUtil(
            JapaneseExternalProcessRunner processRunner,
            @Value("${japanese.ai.deep-translator.executable}") String deepTranslatorExecutable) {
        this.processRunner = processRunner;
        this.deepTranslatorExecutable = deepTranslatorExecutable;
    }

    /**
     * 将一段日语朗读文本翻译为简体中文。
     * 真实传参示例：{@code 今年の給与は去年より低い。} 和空隔离目录。
     * 真实返回示例：返回 {@code 今年的工资比去年低。}。
     * 异常或副作用示例：朗读文本会发送到 Google 翻译；失败或没有译文时抛出系统异常。
     *
     * @param audioText 已验证并获准外发的日语朗读文本
     * @param work 调用方创建的隔离工作目录
     * @return deep-translator 返回的简体中文译文
     */
    public String translateToSimplifiedChinese(String audioText, Path work) {
        processRunner.run(List.of(
                deepTranslatorExecutable,
                "--translator", "google",
                "--source", "ja",
                "--target", "zh-CN",
                "--text", audioText), work, TRANSLATION_TIMEOUT);
        return readTranslation(work.resolve("process-output.log"));
    }

    /**
     * 从 deep-translator 命令输出中提取最终译文并拒绝空结果。
     * 真实传参示例：包含 {@code Translation result: 今年的工资比去年低。} 的日志。
     * 真实返回示例：返回不含 CLI 诊断前缀的 {@code 今年的工资比去年低。}。
     * 异常或副作用示例：日志不存在、缺少结果标记或译文为空时抛出统一系统异常。
     *
     * @param processOutput 统一外部进程输出日志
     * @return 已去除命令诊断信息的中文译文
     */
    private String readTranslation(Path processOutput) {
        try {
            String output = Files.readString(processOutput).strip();
            int markerIndex = output.lastIndexOf(TRANSLATION_RESULT_MARKER);
            String translation = markerIndex < 0
                    ? "" : output.substring(markerIndex + TRANSLATION_RESULT_MARKER.length()).strip();
            if (translation.isEmpty()) {
                throw new IOException("deep-translator 未返回译文。");
            }
            return translation;
        } catch (IOException exception) {
            throw new CommonSystemException(
                    "JAPANESE_TRANSLATION_OUTPUT_MISSING",
                    "免费翻译服务未返回有效中文译文。", exception);
        }
    }
}
