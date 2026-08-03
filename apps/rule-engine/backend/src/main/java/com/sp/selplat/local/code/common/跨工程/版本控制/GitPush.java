/** 跨工程 Git 推送工具归入版本控制模块，不再错误标记为 Fujitsu 业务代码。 */
package com.sp.selplat.local.code.common.跨工程.版本控制;

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
 * Git 批量提交并推送工具。
 *
 * <p>业务上本工具固定读取 `OPTION\fujitsu\GitPush\pushDirPath.txt`，按“路径|分支名|提交说明”逐行执行
 * 本地提交和远程推送，减少手工切目录、切分支和复制 comment 的重复操作。
 */
public class GitPush {

  /** 业务上默认配置文件固定放在 GitPush 目录，便于和 collect 脚本同目录维护。 */
  private static final Path DEFAULT_PUSH_TASK_FILE_PATH =
      Paths.get("C:\\opt\\workspace\\SELPLAT\\OPTION\\fujitsu\\GitPush\\pushDirPath.txt");

  /** 业务上文本文件统一按 UTF-8 读取，避免路径和日文提交说明出现乱码。 */
  private static final java.nio.charset.Charset UTF_8 = StandardCharsets.UTF_8;

  /** 业务上同一个文件里用竖线分隔路径、分支和 comment，避免目录名中的空格影响解析。 */
  private static final String TASK_SEPARATOR = "\\|";

  /** 业务上命令输出统一带时间戳打印，便于回看是哪一条任务失败。 */
  private static final DateTimeFormatter LOG_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  /**
   * 主入口。
   *
   * <p>业务上允许通过参数覆盖任务文件路径；不传参数时默认读取 GitPush 目录下的标准配置文件。
   *
   * @param args 命令行参数。
   * @throws Exception 任务读取或 Git 执行失败时抛出。
   */
  public static void main(String[] args) throws Exception {
    // 业务上优先允许调用方显式指定任务文件，便于不同批次复用同一个工具程序。
    Path pushTaskFilePath =
        args != null && args.length > 0 && args[0] != null && !args[0].isBlank()
            ? Paths.get(args[0]).toAbsolutePath().normalize()
            : DEFAULT_PUSH_TASK_FILE_PATH;
    // 业务上先把配置文件里的批量推送任务全部解析出来，再按顺序逐条执行。
    List<GitPushTask> tasks = readPushTasks(pushTaskFilePath);
    logInfo("读取到待推送任务数: " + tasks.size());
    for (GitPushTask task : tasks) {
      // 业务上每个目录独立处理，某一条失败时直接中断，避免误把后续仓库继续推送出去。
      executePushTask(task);
    }
    logInfo("全部批量推送任务执行完成。");
  }

  /**
   * 读取批量推送任务。
   *
   * <p>业务上配置文件每一行只描述一条目录推送任务，格式固定为“路径|分支名|提交说明”。
   *
   * @param pushTaskFilePath 任务文件路径。
   * @return 解析后的任务列表。
   */
  private static List<GitPushTask> readPushTasks(Path pushTaskFilePath) {
    // 业务上配置文件不存在时要立刻阻断，避免程序静默执行空任务。
    ensureExists(pushTaskFilePath, "pushDirPath.txt 不存在");
    try {
      // 业务上按 UTF-8 整体逐行读取任务文本，保留输入顺序作为真实推送顺序。
      List<String> lines = Files.readAllLines(pushTaskFilePath, UTF_8);
      // 业务上最终返回有效任务列表，跳过空行和注释行，减少批量维护时的干扰。
      List<GitPushTask> tasks = new ArrayList<>();
      for (int index = 0; index < lines.size(); index++) {
        // 当前行先做首尾去空白，保证人工维护文本时多余空格不影响解析。
        String line = lines.get(index) == null ? "" : lines.get(index).trim();
        // 空行和井号注释行不参与推送任务，方便临时屏蔽某一条目录。
        if (line.isEmpty() || line.startsWith("#")) {
          continue;
        }
        // 业务上每行必须提供目录、目标分支和提交说明三段数据，否则无法安全执行 Git 推送。
        String[] segments = line.split(TASK_SEPARATOR, 3);
        if (segments.length != 3) {
          throw new IllegalStateException(
              "pushDirPath.txt 第 " + (index + 1) + " 行格式错误，必须是 路径|分支名|提交说明");
        }
        // 业务上目录必须保留绝对路径或完整相对路径，后两段分别用于 checkout 和 commit。
        String directoryPathText = segments[0] == null ? "" : segments[0].trim();
        String branchName = segments[1] == null ? "" : segments[1].trim();
        String commitMessage = segments[2] == null ? "" : segments[2].trim();
        if (directoryPathText.isEmpty() || branchName.isEmpty() || commitMessage.isEmpty()) {
          throw new IllegalStateException(
              "pushDirPath.txt 第 " + (index + 1) + " 行存在空字段，必须完整填写 路径|分支名|提交说明");
        }
        // 业务上每条任务都提前标准化目录路径，避免后续进程切换目录时路径解析漂移。
        Path directoryPath = Paths.get(directoryPathText).toAbsolutePath().normalize();
        tasks.add(new GitPushTask(directoryPath, branchName, commitMessage));
      }
      if (tasks.isEmpty()) {
        throw new IllegalStateException("pushDirPath.txt 中没有可执行的推送任务。");
      }
      return tasks;
    } catch (IOException exception) {
      // 业务上任务文件读取失败时直接阻断，提醒调用方先修复输入文件或编码问题。
      throw new IllegalStateException("读取 pushDirPath.txt 失败: " + pushTaskFilePath, exception);
    }
  }

  /**
   * 执行单条 Git 推送任务。
   *
   * <p>业务上每条任务都要先确认目录和 Git 仓库存在，再按切分支、提交和推送的固定顺序执行。
   *
   * @param task 单条批量推送任务。
   */
  private static void executePushTask(GitPushTask task) {
    // 业务上开始执行前先把关键上下文打印出来，方便定位当前处理到哪个目录。
    logInfo("开始处理目录: " + task.directoryPath());
    logInfo("目标分支: " + task.branchName());
    logInfo("提交说明: " + task.commitMessage());
    // 业务上目标目录必须真实存在，否则不允许继续执行 Git 命令。
    ensureDirectory(task.directoryPath(), "提交目录不存在");
    // 业务上目录里必须是 Git 仓库，否则 add/commit/push 都没有意义。
    ensureDirectory(task.directoryPath().resolve(".git"), "目标目录不是 Git 仓库");
    // 业务上先确保当前仓库切到目标分支，避免把改动提交到错误分支。
    checkoutBranch(task);
    // 业务上统一先把工作区所有改动纳入暂存，保证本地提交覆盖目录内当前实际改动。
    runGitCommand(task.directoryPath(), "git", "add", "-A");
    // 业务上如果目录里没有任何改动，则不创建空提交，只记录并跳过 push。
    if (!hasWorkingTreeChanges(task.directoryPath())) {
      logInfo("目录没有检测到待提交改动，跳过 commit/push: " + task.directoryPath());
      return;
    }
    // 业务上提交说明直接使用配置文件里的第三段，保证批量执行时 comment 可人工控制。
    runGitCommand(task.directoryPath(), "git", "commit", "-m", task.commitMessage());
    // 业务上推送统一指向 origin 的目标分支，首次推送也顺便建立上游跟踪关系。
    runGitCommand(task.directoryPath(), "git", "push", "-u", "origin", task.branchName());
    logInfo("目录推送完成: " + task.directoryPath());
  }

  /**
   * 切换到目标分支。
   *
   * <p>业务上优先复用本地已存在分支；若本地不存在则尝试跟踪远程分支，再不行时创建新的本地分支。
   *
   * @param task 单条批量推送任务。
   */
  private static void checkoutBranch(GitPushTask task) {
    // 业务上先判断本地分支是否已经存在，存在时直接 checkout，避免重复创建。
    if (isGitCommandSuccessful(task.directoryPath(), "git", "show-ref", "--verify",
        "refs/heads/" + task.branchName())) {
      runGitCommand(task.directoryPath(), "git", "checkout", task.branchName());
      return;
    }
    // 业务上本地没有目标分支时，优先尝试跟踪 origin 上已有分支，避免新建出错误孤立分支。
    if (isGitCommandSuccessful(task.directoryPath(), "git", "ls-remote", "--exit-code", "--heads",
        "origin", task.branchName())) {
      runGitCommand(task.directoryPath(), "git", "checkout", "-b", task.branchName(), "--track",
          "origin/" + task.branchName());
      return;
    }
    // 业务上本地和远程都不存在时，最后退回到创建一个新本地分支，交给后续 push 建立远程分支。
    runGitCommand(task.directoryPath(), "git", "checkout", "-b", task.branchName());
  }

  /**
   * 判断工作区是否存在待提交改动。
   *
   * <p>业务上通过 `git status --short` 读取当前工作区状态，避免创建无意义空提交。
   *
   * @param directoryPath Git 仓库目录。
   * @return 是否存在待提交改动。
   */
  private static boolean hasWorkingTreeChanges(Path directoryPath) {
    // 业务上直接读取 status 输出文本，只要存在任意非空结果就说明当前目录有实际改动。
    String output = runCommand(directoryPath, false, "git", "status", "--short");
    return output != null && !output.trim().isEmpty();
  }

  /**
   * 执行 Git 命令并要求成功。
   *
   * <p>业务上关键命令失败时必须中断当前任务，避免继续在未知状态下提交或推送。
   *
   * @param directoryPath Git 仓库目录。
   * @param command 命令及参数。
   */
  private static void runGitCommand(Path directoryPath, String... command) {
    // 业务上所有关键 Git 命令都要求成功，失败时直接抛错并附带输出内容。
    runCommand(directoryPath, true, command);
  }

  /**
   * 判断 Git 命令是否成功。
   *
   * <p>业务上某些检查命令只关心成功与否，不需要把失败当作异常抛出。
   *
   * @param directoryPath Git 仓库目录。
   * @param command 命令及参数。
   * @return 命令是否成功。
   */
  private static boolean isGitCommandSuccessful(Path directoryPath, String... command) {
    try {
      // 业务上探测命令失败属于正常分支判断，因此这里仅返回布尔值，不对外抛出异常。
      runCommand(directoryPath, true, command);
      return true;
    } catch (IllegalStateException exception) {
      return false;
    }
  }

  /**
   * 执行命令并返回控制台输出。
   *
   * <p>业务上标准输出和错误输出统一合流，便于把 Git 的真实失败原因完整带出来。
   *
   * @param directoryPath 执行目录。
   * @param requireSuccess 是否要求命令成功。
   * @param command 命令及参数。
   * @return 命令输出。
   */
  private static String runCommand(Path directoryPath, boolean requireSuccess, String... command) {
    try {
      // 业务上每条命令都在目标仓库目录下执行，避免 PowerShell 当前目录变化影响批处理结果。
      ProcessBuilder processBuilder = new ProcessBuilder(command);
      // 业务上命令执行目录必须锁定到配置文件指定的 Git 仓库目录。
      processBuilder.directory(directoryPath.toFile());
      // 业务上把标准错误并到标准输出，确保 Git 失败原因不会在日志里丢半截。
      processBuilder.redirectErrorStream(true);
      // 业务上启动本地 Git 子进程，按真实仓库状态执行命令。
      Process process = processBuilder.start();
      // 业务上把命令输出完整收集起来，既用于实时打印，也用于失败时抛错。
      String output = readProcessOutput(process);
      // 等待 Git 子进程结束，确保当前命令完成后才继续下一步。
      int exitCode = process.waitFor();
      // 业务上每条命令都打印出来，方便回看是哪一步 checkout、commit 或 push 失败。
      logInfo("执行命令: " + String.join(" ", command));
      if (output != null && !output.isBlank()) {
        // 命令有输出时原样打印，便于查看 Git 的真实回显。
        logInfo(output.trim());
      }
      if (requireSuccess && exitCode != 0) {
        // 业务上关键命令非零退出时必须终止任务，并把当前命令与输出一起带出去。
        throw new IllegalStateException(
            "命令执行失败，exitCode=" + exitCode + ", command=" + String.join(" ", command)
                + ", output=" + output);
      }
      return output;
    } catch (IOException exception) {
      // 业务上进程启动失败通常说明本机没有 Git 或目录不可执行，需要明确抛出环境错误。
      throw new IllegalStateException("启动命令失败: " + String.join(" ", command), exception);
    } catch (InterruptedException exception) {
      // 业务上等待 Git 进程期间若被中断，要恢复线程中断标记并终止当前批量任务。
      Thread.currentThread().interrupt();
      throw new IllegalStateException("命令执行被中断: " + String.join(" ", command), exception);
    }
  }

  /**
   * 读取子进程输出。
   *
   * <p>业务上统一按 UTF-8 解码输出，减少日文分支名和提交信息回显乱码。
   *
   * @param process 子进程。
   * @return 子进程输出文本。
   * @throws IOException 读取输出失败时抛出。
   */
  private static String readProcessOutput(Process process) throws IOException {
    // 业务上通过缓冲读取一次性拼接完整输出，便于后续统一记录日志或拼装异常信息。
    StringBuilder builder = new StringBuilder();
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(process.getInputStream(), UTF_8))) {
      // 逐行读取命令输出，保留原始行顺序用于问题排查。
      String line;
      while ((line = reader.readLine()) != null) {
        // 每一行输出都追加换行，保证最终日志和 Git 原始回显接近。
        builder.append(line).append(System.lineSeparator());
      }
    }
    return builder.toString();
  }

  /**
   * 确保目标路径存在。
   *
   * <p>业务上配置文件和仓库目录都属于执行前置条件，缺失时必须尽早阻断。
   *
   * @param path 目标路径。
   * @param message 失败消息。
   */
  private static void ensureExists(Path path, String message) {
    // 路径不存在时直接抛错，避免后续流程在缺文件状态下继续执行。
    if (!Files.exists(path)) {
      throw new IllegalStateException(message + ": " + path);
    }
  }

  /**
   * 确保目标目录存在。
   *
   * <p>业务上 Git 处理只能在真实目录下执行，因此目录缺失时必须立刻停止。
   *
   * @param directoryPath 目录路径。
   * @param message 失败消息。
   */
  private static void ensureDirectory(Path directoryPath, String message) {
    // 目标不是目录时直接阻断，避免把文件路径当成仓库目录执行 Git 命令。
    if (!Files.isDirectory(directoryPath)) {
      throw new IllegalStateException(message + ": " + directoryPath);
    }
  }

  /**
   * 输出业务日志。
   *
   * <p>业务上统一由一个方法格式化控制台日志，便于后续扩展到文件日志时保持口径一致。
   *
   * @param message 日志内容。
   */
  private static void logInfo(String message) {
    // 业务上每条日志都带上时间戳，方便回看批量任务的实际执行顺序。
    System.out.println("[" + LOG_TIME_FORMATTER.format(LocalDateTime.now()) + "] " + message);
  }

  /**
   * 单条 Git 推送任务。
   *
   * @param directoryPath 需要提交并推送的 Git 仓库目录。
   * @param branchName 目标分支名称。
   * @param commitMessage 本次提交说明。
   */
  private record GitPushTask(
      Path directoryPath,
      String branchName,
      String commitMessage) {
  }
}
