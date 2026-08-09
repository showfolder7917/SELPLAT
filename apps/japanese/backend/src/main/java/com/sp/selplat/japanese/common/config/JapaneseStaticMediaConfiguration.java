package com.sp.selplat.japanese.common.config;

import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** 让运行中的 Host 无需重启即可访问刚写入 static/pic 与 static/audio 的媒体。 */
@Configuration
public class JapaneseStaticMediaConfiguration implements WebMvcConfigurer {

    private final Path staticRoot;

    /**
     * 定位 japanese 源码静态资源根，供本地媒体文件即时访问。
     * 真实传参示例：从 SELPLAT 根或 apps/host/backend 启动。
     * 真实返回示例：构造后绑定 {@code apps/japanese/backend/src/main/resources/static}。
     * 异常或副作用示例：无法定位工程根时启动失败；构造不创建目录。
     */
    public JapaneseStaticMediaConfiguration() {
        staticRoot = locateProjectRoot().resolve(
                "apps/japanese/backend/src/main/resources/static").normalize();
    }

    /**
     * 注册图片和语音文件系统访问路径。
     * 真实传参示例：Spring MVC 提供的空 ResourceHandlerRegistry。
     * 真实返回示例：{@code /pic/x.webp} 与 {@code /audio/x.mp3} 直接读取源码静态目录。
     * 异常或副作用示例：目录尚未创建时仍可启动；只增加只读 HTTP 映射。
     *
     * @param registry Spring 静态资源处理器注册表
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/pic/**")
                .addResourceLocations(directoryLocation(staticRoot.resolve("pic")));
        registry.addResourceHandler("/audio/**")
                .addResourceLocations(directoryLocation(staticRoot.resolve("audio")));
    }

    /**
     * 把本地媒体目录转换成 Spring 明确认可的目录 URL。
     * 真实传参示例：{@code .../static/pic}。
     * 真实返回示例：{@code file:///.../static/pic/}。
     * 异常或副作用示例：目录尚不存在时仍只返回 URL，不创建文件。
     *
     * @param directory 图片或语音目录
     * @return 以斜线结尾的文件目录 URL
     */
    private String directoryLocation(Path directory) {
        String location = directory.toUri().toString();
        return location.endsWith("/") ? location : location + "/";
    }

    /**
     * 从当前运行目录向上定位唯一 SELPLAT 根。
     * 真实传参示例：读取当前 Java 进程 user.dir。
     * 真实返回示例：返回包含 settings.gradle 和 apps/japanese 的目录。
     * 异常或副作用示例：无法定位时抛出异常；不修改文件。
     *
     * @return 当前 SELPLAT 根
     */
    private Path locateProjectRoot() {
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
