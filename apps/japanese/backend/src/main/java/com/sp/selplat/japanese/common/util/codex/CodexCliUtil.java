package com.sp.selplat.japanese.common.util.codex;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.japanese.common.util.process.JapaneseExternalProcessRunner;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 封装本机 Codex CLI 的解释与题意原图生成，不包含具体题库业务编排。 */
@Component
public class CodexCliUtil {

    private static final Duration CODEX_TIMEOUT = Duration.ofMinutes(8);
    private final JapaneseExternalProcessRunner processRunner;
    private final String codexExecutable;

    /**
     * 装配统一外部进程边界与 Codex CLI 路径。
     * 真实传参示例：假的进程执行器和 {@code /fake/codex}。
     * 真实返回示例：构造后可在调用方提供的隔离目录运行 Codex。
     * 异常或副作用示例：路径不可执行时首次生成抛出系统异常；构造不启动进程。
     *
     * @param processRunner 不经过 Shell 的外部进程执行器
     * @param codexExecutable Codex CLI 可执行路径
     */
    public CodexCliUtil(
            JapaneseExternalProcessRunner processRunner,
            @Value("${japanese.ai.codex.executable}") String codexExecutable) {
        this.processRunner = processRunner;
        this.codexExecutable = codexExecutable;
    }

    /**
     * 生成面向中文学习者的日语题目解释。
     * 真实传参示例：正确答案为 D 的 N2 读音题和空隔离目录。
     * 真实返回示例：{@code 給与读作きゅうよ，正确答案是 D。}。
     * 异常或副作用示例：Codex 未写最终消息时抛出系统异常；仅在隔离目录写输出。
     *
     * @param request 当前题干、选项和答案
     * @param work 调用方创建的隔离工作目录
     * @return Codex 最终解释正文
     */
    public String generateExplanation(CommonParam request, Path work) {
        Path finalMessage = work.resolve("explanation.txt");
        processRunner.run(codexCommand(
                work, "read-only", false, finalMessage, explanationPrompt(request)),
                work, CODEX_TIMEOUT);
        return readRequired(finalMessage, "Codex 未返回解释内容。");
    }

    /**
     * 生成一张不含文字的题意原图。
     * 真实传参示例：语法题上下文和 {@code /tmp/japanese-codex-image}。
     * 真实返回示例：返回非空的 {@code generated-image.png} 路径。
     * 异常或副作用示例：Codex 未产生图片时抛出系统异常；原图只写隔离目录。
     *
     * @param request 当前题干、选项和答案
     * @param work 调用方创建的隔离工作目录
     * @return Codex 生成的原始图片路径
     */
    public Path generateImage(CommonParam request, Path work) {
        Path finalMessage = work.resolve("image-result.txt");
        Path requestedImage = work.resolve("generated-image.png");
        processRunner.run(codexCommand(
                work, "workspace-write", true, finalMessage,
                imagePrompt(request, requestedImage)), work, CODEX_TIMEOUT);
        return findGeneratedImage(work, requestedImage);
    }

    private List<String> codexCommand(
            Path work,
            String sandbox,
            boolean approveForMe,
            Path finalMessage,
            String prompt) {
        List<String> command = new ArrayList<>(List.of(
                codexExecutable, "exec", "--ephemeral", "--ignore-rules",
                "--skip-git-repo-check", "-C", work.toString(),
                "--sandbox", sandbox, "-o", finalMessage.toString()));
        if (approveForMe) {
            command.add("--approve-for-me");
        }
        command.add(prompt);
        return command;
    }

    private String explanationPrompt(CommonParam request) {
        return "你是日语能力考试 N2 教师。请直接用简体中文解释下面选择题，必须说明正确答案、关键读音或语法、"
                + "其他选项为什么不对，并给出一句自然日语例句。不要修改文件，不要请求确认，只输出最终解释正文。\n"
                + questionContext(request);
    }

    private String imagePrompt(CommonParam request, Path output) {
        return "使用当前可用的图片生成能力，为下面这道日语 N2 题生成一张清晰、真实、适合学习卡片的横版语义插图。"
                + "图片中不得出现文字、字母、选项、答案或水印。将最终原图保存到绝对路径 " + output + "。"
                + "不要修改任何工程文件，不要请求确认。完成后只回复最终图片路径。\n"
                + questionContext(request);
    }

    private String questionContext(CommonParam request) {
        return "题型：" + value(request, "questionType")
                + "\n题干：" + value(request, "questionText")
                + "\nA：" + value(request, "optionA") + "\nB：" + value(request, "optionB")
                + "\nC：" + value(request, "optionC") + "\nD：" + value(request, "optionD")
                + "\n正确答案：" + value(request, "correctOption");
    }

    private String value(CommonParam request, String field) {
        Object value = request == null ? null : request.getParam(field);
        return value == null ? "" : String.valueOf(value).strip();
    }

    private String readRequired(Path path, String message) {
        try {
            if (!Files.isRegularFile(path)) {
                throw new IOException(message);
            }
            String value = Files.readString(path).strip();
            if (value.isEmpty()) {
                throw new IOException(message);
            }
            return value;
        } catch (IOException exception) {
            throw new CommonSystemException("JAPANESE_CODEX_OUTPUT_MISSING", message, exception);
        }
    }

    private Path findGeneratedImage(Path work, Path requestedImage) {
        if (isNonEmptyFile(requestedImage)) {
            return requestedImage;
        }
        try (Stream<Path> files = Files.list(work)) {
            return files.filter(this::isNonEmptyFile)
                    .filter(path -> {
                        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
                        return name.endsWith(".png") || name.endsWith(".jpg")
                                || name.endsWith(".jpeg") || name.endsWith(".webp");
                    })
                    .findFirst()
                    .orElseThrow(() -> new IOException("Codex 未生成图片文件。"));
        } catch (IOException exception) {
            throw new CommonSystemException(
                    "JAPANESE_CODEX_IMAGE_MISSING", "Codex 没有返回可用图片。", exception);
        }
    }

    private boolean isNonEmptyFile(Path path) {
        try {
            return Files.isRegularFile(path) && Files.size(path) > 0L;
        } catch (IOException exception) {
            return false;
        }
    }
}
