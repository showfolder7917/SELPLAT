package com.sp.selplat.japanese.common.util.process;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

/** 为 Codex CLI、edge-tts 和 FFmpeg 提供可替换、可测试的统一进程执行边界。 */
public interface JapaneseExternalProcessRunner {

    /**
     * 在隔离目录执行一条不经过 Shell 拼接的命令。
     * 真实传参示例：{@code [edge-tts,--voice,ja-JP-NanamiNeural,...]}。
     * 真实返回示例：进程退出码为零时正常返回且输出文件已由命令创建。
     * 异常或副作用示例：超时或非零退出时抛出系统异常；命令可能在工作目录创建文件。
     *
     * @param command 已拆分的可执行文件和参数
     * @param workingDirectory 当前命令唯一工作目录
     * @param timeout 最大运行时间
     */
    void run(List<String> command, Path workingDirectory, Duration timeout);
}
