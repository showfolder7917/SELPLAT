package com.sp.selplat.common.fujitsu;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 通用目录 ACL 修复工具。
 *
 * <p>业务上该工具用于在 Windows 本机上一键修复指定目录树的 owner、继承和写权限，
 * 当前版本默认固定修复 `common-db\build` 目录，方便后续继续在该目录内写入编译产物。
 */
public class DirectoryAclRepairTool {

    /** 业务上这里固定维护当前要修复的目标目录，你后续只需改这一行再直接运行 main。 */
    private static final Path TARGET_DIRECTORY =
        Paths.get("C:\\opt\\bat\\SBMAB203\\OPTION")
            .toAbsolutePath()
            .normalize();

    /** 业务上日志时间统一带到秒级，方便排查每一步 native 命令的执行顺序。 */
    private static final DateTimeFormatter LOG_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * 主入口。
     *
     * <p>业务上当前版本直接按源码里固定目录执行修复，便于你修改一行路径后再次直接运行 main。
     *
     * @param args 命令行参数，当前版本未使用。
     * @throws Exception 目录不存在、系统命令失败或写入探针失败时抛出。
     */
    public static void main(String[] args) throws Exception {
        // 业务上直接读取源码里维护的固定目标目录，避免每次运行都依赖外部传参。
        Path targetDirectory = TARGET_DIRECTORY;
        // 业务上日志固定落在目标目录下，便于每个被修复目录都把修复记录保存在自己的上下文里。
        Path logPath = targetDirectory.resolve("directory-acl-repair.log");
        // 业务上先校验目标目录存在，避免把 takeown/icacls 打到错误路径。
        ensureDirectoryExists(targetDirectory, "目标目录不存在");
        // 业务上先记录本次修复目标，便于回看日志时确认命中的真实目录。
        logInfo(logPath, "targetDirectory=" + targetDirectory);
        // 业务上先把目录 owner 递归切到当前执行用户，后续权限授予才不会被旧 owner 持续拦截。
        runNativeCommand(logPath, "takeown.exe", "/f", targetDirectory.toString(), "/r", "/d", "y");
        // 业务上先恢复继承，避免目录树里残留断继承的子目录继续拦截后续写入。
        runNativeCommand(logPath, "icacls.exe", targetDirectory.toString(), "/inheritance:e", "/t", "/c");
        // 业务上给当前执行用户授予目录树完全控制，确保后续文件维护和构建产物写入都可继续进行。
        runNativeCommand(logPath, "icacls.exe", targetDirectory.toString(), "/grant", currentUser() + ":(OI)(CI)F", "/t", "/c");
        // 业务上同时给 Authenticated Users 保留修改权限，方便同机其他受信账号后续协作维护该目录。
        runNativeCommand(logPath, "icacls.exe", targetDirectory.toString(), "/grant", "NT AUTHORITY\\Authenticated Users:(OI)(CI)M", "/t", "/c");
        // 业务上去掉目录树内可能残留的只读属性，避免 ACL 修完后仍被属性位阻塞写入。
        runNativeCommand(logPath, "attrib.exe", "-R", targetDirectory.resolve("*").toString(), "/S", "/D");
        // 业务上最后通过探针目录和探针文件验证该目录已具备真实写入能力，而不是只看命令退出码。
        ensureDirectoryWritable(targetDirectory, logPath);
        // 业务上收口记录成功状态，便于脚本或人工快速判断本次修复已经完成。
        logInfo(logPath, "ACL_REPAIR_COMPLETED");
    }

    /**
     * 校验目录存在。
     *
     * <p>业务上权限修复只能针对真实目录执行，因此路径缺失时必须立即失败。
     *
     * @param directoryPath 目录路径。
     * @param message 失败消息。
     */
    private static void ensureDirectoryExists(Path directoryPath, String message) {
        // 业务上如果目标不是目录，就直接阻断，避免把命令误打到文件或不存在路径上。
        if (!Files.isDirectory(directoryPath)) {
            throw new IllegalStateException(message + ": " + directoryPath);
        }
    }

    /**
     * 获取当前执行用户。
     *
     * <p>业务上当前 ACL 授权直接绑定到实际运行该工具的 Windows 账号，避免工具里写死账户名。
     *
     * @return 当前执行用户名。
     */
    private static String currentUser() {
        // 业务上优先读取标准 Windows 用户域和用户名组合，保持授予 ACL 时的主体格式稳定。
        String userDomain = System.getenv("USERDOMAIN");
        String userName = System.getenv("USERNAME");
        if (userDomain != null && !userDomain.isBlank() && userName != null && !userName.isBlank()) {
            return userDomain + "\\" + userName;
        }
        // 业务上环境变量缺失时退回到 JVM 的登录用户名，至少保证命令还能继续拼出主体名。
        return System.getProperty("user.name");
    }

    /**
     * 执行 native 命令并要求成功。
     *
     * <p>业务上 takeown、icacls 和 attrib 任一步失败都意味着 ACL 修复未完成，因此要直接抛错。
     *
     * @param logPath 日志文件路径。
     * @param command 命令及参数。
     * @throws Exception 命令失败时抛出。
     */
    private static void runNativeCommand(Path logPath, String... command) throws Exception {
        // 业务上统一记录即将执行的命令，便于失败时直接回看哪一步没通过。
        logInfo(logPath, "run=" + String.join(" ", command));
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        // 业务上把错误输出并到标准输出，避免系统命令失败原因被拆散丢失。
        processBuilder.redirectErrorStream(true);
        Process process = processBuilder.start();
        String output = readProcessOutput(process);
        int exitCode = process.waitFor();
        if (!output.isBlank()) {
            // 业务上系统命令回显原样记日志，便于回看 icacls 的逐文件处理结果。
            logInfo(logPath, output.trim());
        }
        // 业务上 native 命令非零退出就直接中断，避免后续验证建立在半修复状态上。
        if (exitCode != 0) {
            throw new IllegalStateException(
                "native command failed, exitCode=" + exitCode + ", command=" + String.join(" ", command));
        }
    }

    /**
     * 读取子进程输出。
     *
     * <p>业务上 ACL 修复过程中的系统命令输出需要完整收集到日志里，方便排查失败原因。
     *
     * @param process 子进程。
     * @return 合并后的标准输出文本。
     * @throws IOException 读取失败时抛出。
     */
    private static String readProcessOutput(Process process) throws IOException {
        // 业务上统一按 UTF-8 解码命令回显，避免 Windows 本机输出在日志里乱码。
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader =
            new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            // 逐行读取系统命令输出，保持日志里能完整回放每一步修复动作。
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        }
        // 业务上统一用系统换行拼回完整文本，便于直接写入日志文件。
        return String.join(System.lineSeparator(), lines);
    }

    /**
     * 验证目标目录可写。
     *
     * <p>业务上仅凭 icacls 成功不足以证明目录真的能写，因此这里追加探针目录和探针文件校验。
     *
     * @param directoryPath 待验证目录。
     * @param logPath 日志文件路径。
     * @throws IOException 写入或删除探针失败时抛出。
     */
    private static void ensureDirectoryWritable(Path directoryPath, Path logPath) throws IOException {
        // 业务上探针目录单独命名，避免影响业务文件并且便于失败时快速识别残留。
        Path probeDirectory = directoryPath.resolve("_codex_acl_probe_dir");
        // 业务上探针文件用于验证目录不仅能建子目录，也能继续写文件内容。
        Path probeFile = probeDirectory.resolve("probe.txt");
        if (Files.exists(probeDirectory)) {
            // 业务上如果上次验证残留探针，先清掉再做新一轮验证，避免旧残留掩盖当前状态。
            deleteRecursively(probeDirectory);
        }
        // 业务上先创建探针目录，验证当前目录对子目录创建权限已经恢复。
        Files.createDirectories(probeDirectory);
        // 业务上再写探针文件，验证当前目录树内文件写入权限也已恢复。
        Files.writeString(probeFile, "acl-ok", StandardCharsets.UTF_8);
        // 业务上验证完立即清理探针，避免在业务目录里长期留下无用测试文件。
        deleteRecursively(probeDirectory);
        // 业务上记录写入验证通过，便于人工只看日志就知道权限已经真的修好。
        logInfo(logPath, "writeTestOk=" + directoryPath);
    }

    /**
     * 递归删除探针目录。
     *
     * <p>业务上探针目录只由当前工具创建，验证完成后应当完整清理，避免污染业务目录。
     *
     * @param targetPath 待删除路径。
     * @throws IOException 删除失败时抛出。
     */
    private static void deleteRecursively(Path targetPath) throws IOException {
        // 业务上路径不存在时无需额外处理，说明当前没有探针残留。
        if (!Files.exists(targetPath)) {
            return;
        }
        try (var pathStream = Files.walk(targetPath)) {
            // 业务上先删文件再删目录，保证 Windows 下目录删除不会因子项未清空失败。
            pathStream.sorted((left, right) -> right.getNameCount() - left.getNameCount())
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException exception) {
                        throw new IllegalStateException("failed to delete probe path: " + path, exception);
                    }
                });
        }
    }

    /**
     * 输出并落盘日志。
     *
     * <p>业务上 ACL 修复属于运维型工具，需要同时把关键动作打印到控制台并写入目标目录日志文件。
     *
     * @param logPath 日志文件路径。
     * @param message 日志内容。
     */
    private static void logInfo(Path logPath, String message) {
        // 业务上统一给每条日志带时间戳，便于对照 native 命令回显定位执行顺序。
        String line = "[" + LOG_TIME_FORMATTER.format(LocalDateTime.now()) + "] " + message;
        System.out.println(line);
        try {
            // 业务上日志文件统一追加写入，便于多次运行后连续回看每次修复记录。
            Files.writeString(
                logPath,
                line + System.lineSeparator(),
                StandardCharsets.UTF_8,
                Files.exists(logPath)
                    ? new java.nio.file.OpenOption[] {
                        java.nio.file.StandardOpenOption.CREATE,
                        java.nio.file.StandardOpenOption.APPEND
                    }
                    : new java.nio.file.OpenOption[] {
                        java.nio.file.StandardOpenOption.CREATE
                    });
        } catch (IOException exception) {
            throw new IllegalStateException("failed to write log: " + logPath, exception);
        }
    }
}
