package com.sp.selplat.japanese.runtime;

import com.sp.selplat.common.exception.CommonSystemException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

/** 使用 ProcessBuilder 执行受控参数列表，不允许题目内容进入 Shell 命令解释。 */
@Component
public class DefaultJapaneseExternalProcessRunner implements JapaneseExternalProcessRunner {

    /**
     * 执行外部媒体或 Codex 命令并把诊断输出保存在隔离目录。
     * 真实传参示例：Codex CLI、edge-tts 或 FFmpeg 参数列表。
     * 真实返回示例：退出码为零后调用方读取生成文件。
     * 异常或副作用示例：超时会强制终止子进程；失败日志保留在 process-output.log。
     *
     * @param command 不经过 Shell 的完整参数列表
     * @param workingDirectory 隔离工作目录
     * @param timeout 最大等待时间
     */
    @Override
    public void run(List<String> command, Path workingDirectory, Duration timeout) {
        try {
            Files.createDirectories(workingDirectory);
            Path processLog = workingDirectory.resolve("process-output.log");
            Process process = new ProcessBuilder(command)
                    .directory(workingDirectory.toFile())
                    .redirectErrorStream(true)
                    .redirectOutput(processLog.toFile())
                    .start();
            boolean completed = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
            if (!completed) {
                process.destroyForcibly();
                throw new CommonSystemException(
                        "JAPANESE_EXTERNAL_PROCESS_TIMEOUT",
                        "生成任务运行超时，请稍后重试。", null);
            }
            if (process.exitValue() != 0) {
                String detail = Files.isRegularFile(processLog)
                        ? Files.readString(processLog) : "";
                throw new CommonSystemException(
                        "JAPANESE_EXTERNAL_PROCESS_FAILED",
                        "生成任务执行失败：" + abbreviate(detail), null);
            }
        } catch (IOException exception) {
            throw new CommonSystemException(
                    "JAPANESE_EXTERNAL_PROCESS_START_FAILED",
                    "无法启动生成任务，请检查本机能力配置。", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new CommonSystemException(
                    "JAPANESE_EXTERNAL_PROCESS_INTERRUPTED",
                    "生成任务已中断。", exception);
        }
    }

    /**
     * 限制外部进程错误摘要长度，避免完整日志进入 HTTP 响应。
     * 真实传参示例：超过四百字的 Codex 错误日志。
     * 真实返回示例：返回末尾带省略号的四百字摘要。
     * 异常或副作用示例：空日志返回固定提示；不修改原始日志文件。
     *
     * @param detail 外部进程诊断文本
     * @return 安全长度的错误摘要
     */
    private String abbreviate(String detail) {
        String normalized = detail == null ? "" : detail.strip();
        if (normalized.isEmpty()) {
            return "未返回诊断信息。";
        }
        return normalized.length() <= 400
                ? normalized : normalized.substring(0, 400) + "…";
    }
}
