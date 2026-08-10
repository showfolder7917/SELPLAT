package com.sp.selplat.japanese.common.util.image;

import com.sp.selplat.japanese.common.util.process.JapaneseExternalProcessRunner;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 封装 FFmpeg WebP 转换参数，不包含 Codex 或题库业务逻辑。 */
@Component
public class FfmpegImageUtil {

    private static final Duration IMAGE_TIMEOUT = Duration.ofMinutes(3);
    private final JapaneseExternalProcessRunner processRunner;
    private final String ffmpegExecutable;

    /**
     * 装配统一外部进程边界与 FFmpeg 路径。
     * 真实传参示例：假的进程执行器和 {@code /opt/homebrew/bin/ffmpeg}。
     * 真实返回示例：构造后固定使用 WebP 质量 82。
     * 异常或副作用示例：路径不可执行时首次转换抛出系统异常；构造不启动进程。
     *
     * @param processRunner 不经过 Shell 的外部进程执行器
     * @param ffmpegExecutable FFmpeg 可执行路径
     */
    public FfmpegImageUtil(
            JapaneseExternalProcessRunner processRunner,
            @Value("${japanese.ai.ffmpeg.executable}") String ffmpegExecutable) {
        this.processRunner = processRunner;
        this.ffmpegExecutable = ffmpegExecutable;
    }

    /**
     * 把生成原图压缩为 WebP。
     * 真实传参示例：{@code generated-image.png} 和同一隔离目录。
     * 真实返回示例：返回 {@code generated-image.webp}。
     * 异常或副作用示例：FFmpeg 失败时抛出系统异常；成功后在隔离目录新增 WebP。
     *
     * @param sourceImage Codex 生成的原图
     * @param work 调用方创建的隔离工作目录
     * @return 转换后的 WebP 路径
     */
    public Path convertToWebp(Path sourceImage, Path work) {
        Path webp = work.resolve("generated-image.webp");
        processRunner.run(List.of(
                ffmpegExecutable, "-y", "-i", sourceImage.toString(),
                "-c:v", "libwebp", "-quality", "82", webp.toString()),
                work, IMAGE_TIMEOUT);
        return webp;
    }
}
