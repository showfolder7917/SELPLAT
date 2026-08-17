package com.sp.selplat.japanese.common.util.speech;

import com.sp.selplat.japanese.common.util.process.JapaneseExternalProcessRunner;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 封装指定 edge-tts 环境和 NanamiNeural 音色，不包含题库保存逻辑。 */
@Component
public class EdgeTtsSpeechUtil {

    private static final Duration SPEECH_TIMEOUT = Duration.ofMinutes(3);
    private final JapaneseExternalProcessRunner processRunner;
    private final String edgeTtsExecutable;

    /**
     * 装配统一外部进程边界与 edge-tts 路径。
     * 真实传参示例：假的进程执行器和 {@code OPTION/plugin/edge-tts-venv/bin/edge-tts}。
     * 真实返回示例：构造后固定使用 {@code ja-JP-NanamiNeural}。
     * 异常或副作用示例：路径不可执行时首次生成抛出系统异常；构造不启动进程。
     *
     * @param processRunner 不经过 Shell 的外部进程执行器
     * @param edgeTtsExecutable edge-tts 可执行路径
     */
    public EdgeTtsSpeechUtil(
            JapaneseExternalProcessRunner processRunner,
            @Value("${japanese.ai.edge-tts.executable}") String edgeTtsExecutable) {
        this.processRunner = processRunner;
        this.edgeTtsExecutable = edgeTtsExecutable;
    }

    /**
     * 将日语文本生成 NanamiNeural MP3。
     * 真实传参示例：{@code 給与} 和空隔离目录。
     * 真实返回示例：返回 {@code generated-audio.mp3}。
     * 异常或副作用示例：edge-tts 失败时抛出系统异常；输出只写隔离目录。
     *
     * @param text 已验证的日语朗读文本
     * @param work 调用方创建的隔离工作目录
     * @return 生成的 MP3 文件路径
     */
    public Path generate(String text, Path work) {
        Path audio = work.resolve("generated-audio.mp3");
        processRunner.run(List.of(
                edgeTtsExecutable,
                "--voice", "ja-JP-NanamiNeural",
                "--text", text,
                "--write-media", audio.toString()), work, SPEECH_TIMEOUT);
        return audio;
    }
}
