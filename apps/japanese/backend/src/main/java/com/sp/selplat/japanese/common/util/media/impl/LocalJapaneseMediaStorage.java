package com.sp.selplat.japanese.common.util.media.impl;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.japanese.common.util.media.JapaneseMediaStorage;
import com.sp.selplat.japanese.common.util.media.JapaneseMediaType;
import com.sp.selplat.japanese.common.util.media.model.JapaneseMediaAsset;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** 把题库媒体写入 japanese 工程 static/pic 或 static/audio，并返回稳定公开 URL。 */
@Component
public class LocalJapaneseMediaStorage implements JapaneseMediaStorage {

    private final Path staticRoot;
    private final Clock clock;

    /**
     * 从当前 SELPLAT 根定位 japanese 静态资源目录。
     * 真实传参示例：读取当前 Java 进程 {@code user.dir}，不接收业务参数。
     * 真实返回示例：构造后绑定 {@code apps/japanese/backend/src/main/resources/static}。
     * 异常或副作用示例：工程根不存在时抛出异常；构造过程不创建目录。
     */
    public LocalJapaneseMediaStorage() {
        this(locateProjectRoot(), Clock.systemUTC());
    }

    /**
     * 为隔离测试绑定指定 SELPLAT 根和时间源。
     * 真实传参示例：JUnit 临时目录与固定时钟。
     * 真实返回示例：构造后所有文件只写入临时 apps/japanese。
     * 异常或副作用示例：路径无效时首次写入失败；构造本身没有文件副作用。
     *
     * @param projectRoot 当前 SELPLAT 根
     * @param clock 文件名时间来源
     */
    public LocalJapaneseMediaStorage(Path projectRoot, Clock clock) {
        this.staticRoot = projectRoot.resolve(
                "apps/japanese/backend/src/main/resources/static").normalize();
        this.clock = clock;
    }

    /**
     * 原子保存最终媒体并返回本地访问地址。
     * 真实传参示例：{@code IMAGE,/tmp/question.webp}。
     * 真实返回示例：对象键 {@code pic/n2-blue-book-question-123-a.webp}。
     * 异常或副作用示例：成功时新增文件，复制失败时删除临时目标并抛出系统异常。
     *
     * @param mediaType 图片或音频类型
     * @param sourceFile 已验证的最终媒体
     * @return 本地媒体对象
     */
    @Override
    public JapaneseMediaAsset store(JapaneseMediaType mediaType, Path sourceFile) {
        Path temporaryTarget = null;
        try {
            if (!Files.isRegularFile(sourceFile) || Files.size(sourceFile) == 0L) {
                throw new IOException("媒体源文件不存在或为空。");
            }
            Path directory = staticRoot.resolve(mediaType.directory()).normalize();
            if (!directory.startsWith(staticRoot)) {
                throw new IOException("媒体目录逃逸 static 根。");
            }
            Files.createDirectories(directory);
            String fileName = "n2-blue-book-question-" + clock.millis() + "-"
                    + UUID.randomUUID().toString().substring(0, 8) + "." + mediaType.extension();
            Path target = directory.resolve(fileName);
            temporaryTarget = directory.resolve(fileName + ".tmp");
            Files.copy(sourceFile, temporaryTarget, StandardCopyOption.REPLACE_EXISTING);
            Files.move(temporaryTarget, target, StandardCopyOption.ATOMIC_MOVE);
            String objectKey = mediaType.directory() + "/" + fileName;
            return new JapaneseMediaAsset(
                    "local", objectKey, "/" + objectKey,
                    mediaType.contentType(), Files.size(target));
        } catch (IOException exception) {
            if (temporaryTarget != null) {
                try {
                    Files.deleteIfExists(temporaryTarget);
                } catch (IOException ignored) {
                    // 原始异常保留为主因，临时文件会在后续同名冲突检查中暴露。
                }
            }
            throw new CommonSystemException(
                    "JAPANESE_MEDIA_STORE_FAILED", "媒体保存失败，请稍后重试。", exception);
        }
    }

    /**
     * 从运行目录向上定位唯一 SELPLAT 根。
     * 真实传参示例：从 {@code apps/japanese/backend} 启动应用。
     * 真实返回示例：返回同时包含 settings.gradle 与 apps/japanese 的目录。
     * 异常或副作用示例：无法定位时抛出异常；不修改文件。
     *
     * @return 当前 SELPLAT 根
     */
    private static Path locateProjectRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            if (Files.isRegularFile(current.resolve("settings.gradle"))
                    && Files.isDirectory(current.resolve("apps/japanese"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("无法定位包含 apps/japanese 的 SELPLAT 工程根。");
    }
}
