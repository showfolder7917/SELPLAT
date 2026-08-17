package com.sp.selplat.japanese;

import static org.assertj.core.api.Assertions.assertThat;

import com.sp.selplat.japanese.common.util.process.DefaultJapaneseExternalProcessRunner;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** 验证 Japanese 外部进程边界会明确结束标准输入，防止非交互 CLI 永久等待。 */
class JapaneseExternalProcessRunnerContractTest {

    @TempDir
    Path work;

    /**
     * 验证命令参数传完后子进程立即收到 stdin EOF。
     * 真实传参示例：运行当前 JDK，并让探针读取一次标准输入。
     * 真实返回示例：进程在三秒内结束，日志包含 {@code stdin-eof}。
     * 异常或副作用示例：若输入流未关闭，探针持续等待并由运行器按超时强制终止。
     *
     * @throws IOException 测试日志读取失败
     */
    @Test
    void shouldCloseChildStandardInputBeforeWaiting() throws IOException {
        DefaultJapaneseExternalProcessRunner runner = new DefaultJapaneseExternalProcessRunner();
        runner.run(List.of(
                javaExecutable(),
                "-cp",
                System.getProperty("java.class.path"),
                StdinEofProbe.class.getName()), work, Duration.ofSeconds(3));

        assertThat(Files.readString(work.resolve("process-output.log"))).contains("stdin-eof");
    }

    /**
     * 返回当前测试 JDK 的跨平台 Java 可执行文件。
     * 真实传参示例：macOS 返回 {@code <java.home>/bin/java}。
     * 真实返回示例：Windows 返回以 {@code java.exe} 结尾的路径。
     * 异常或副作用示例：只组装路径，不启动进程且不修改文件。
     *
     * @return 当前 JDK 的 Java 可执行文件绝对路径
     */
    private String javaExecutable() {
        String executable = System.getProperty("os.name", "")
                .toLowerCase(Locale.ROOT).contains("win") ? "java.exe" : "java";
        return Path.of(System.getProperty("java.home"), "bin", executable).toString();
    }

    /** 仅供子进程验证 stdin EOF，不参与业务运行。 */
    public static final class StdinEofProbe {

        private StdinEofProbe() {
        }

        /**
         * 读取一次标准输入并在收到 EOF 后输出稳定标记。
         * 真实传参示例：空参数数组与已关闭的标准输入。
         * 真实返回示例：标准输出写入 {@code stdin-eof} 后正常结束。
         * 异常或副作用示例：若收到真实字节则抛出异常；只写子进程标准输出。
         *
         * @param args 未使用的启动参数
         * @throws IOException 标准输入读取失败
         */
        public static void main(String[] args) throws IOException {
            if (System.in.read() != -1) {
                throw new IOException("Expected stdin EOF.");
            }
            System.out.print("stdin-eof");
        }
    }
}
