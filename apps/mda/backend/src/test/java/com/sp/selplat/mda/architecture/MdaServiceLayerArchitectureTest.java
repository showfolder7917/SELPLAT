package com.sp.selplat.mda.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import com.sp.selplat.mda.projectgenerator.controller.MdaProjectGeneratorController;
import com.sp.selplat.mda.projectgenerator.service.MdaProjectGeneratorService;
import com.sp.selplat.mda.projectgenerator.service.impl.MdaProjectGeneratorServiceImpl;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.stereotype.Service;

/** 阻止 MDA 的 Service 契约、实现目录和 Controller 依赖关系再次退化。 */
class MdaServiceLayerArchitectureTest {

    private static final Pattern FEATURE_SERVICE_CONTRACT =
            Pattern.compile("(?:^|/)service/[^/]+Service\\.java$");
    private static final Pattern SERVICE_IMPLEMENTATION =
            Pattern.compile("(?:^|/)service/impl/[^/]+ServiceImpl\\.java$");

    /**
     * 验证工程生成器由接口和 Spring 实现类组成，Controller 只依赖接口。
     * 真实传参示例：反射检查 {@code MdaProjectGeneratorController} 的公开构造器。
     * 真实返回示例：接口可分配给实现类，实现类带 {@code @Service}。
     * 异常或副作用示例：实现类直接注入 Controller 时断言失败；测试不修改文件。
     */
    @Test
    void projectGeneratorMustExposeInterfaceAndHideImplementationFromController() {
        assertThat(MdaProjectGeneratorService.class).isInterface();
        assertThat(MdaProjectGeneratorService.class)
                .isAssignableFrom(MdaProjectGeneratorServiceImpl.class);
        assertThat(MdaProjectGeneratorServiceImpl.class).hasAnnotation(Service.class);
        assertThat(MdaProjectGeneratorController.class.getConstructors())
                .anySatisfy(constructor -> assertThat(constructor.getParameterTypes())
                        .containsExactly(MdaProjectGeneratorService.class));
    }

    /**
     * 验证所有功能 Service 根目录只保存接口，实现统一进入 service/impl。
     * 真实传参示例：扫描 {@code apps/mda/backend/src/main/java/com/sp/selplat/mda}。
     * 真实返回示例：每个 {@code *Service.java} 是接口，每个实现带注解并实现契约。
     * 异常或副作用示例：具体类误放 service 根目录会失败；扫描过程只读源码。
     *
     * @throws IOException 源码目录无法遍历时终止测试
     */
    @Test
    void featureServicesMustFollowContractAndImplementationDirectories() throws IOException {
        Path sourceRoot = locateMdaSourceRoot();
        List<Path> javaFiles;
        try (Stream<Path> files = Files.walk(sourceRoot)) {
            javaFiles = files.filter(path -> path.toString().endsWith(".java")).toList();
        }

        List<Path> contracts = javaFiles.stream()
                .filter(path -> FEATURE_SERVICE_CONTRACT.matcher(relative(sourceRoot, path)).find())
                .filter(path -> !relative(sourceRoot, path).startsWith("common/service/"))
                .toList();
        assertThat(contracts).isNotEmpty();
        for (Path contract : contracts) {
            assertThat(Files.readString(contract))
                    .as("Service 根目录只能保存接口：%s", relative(sourceRoot, contract))
                    .contains("public interface ")
                    .doesNotContain("org.springframework.stereotype.Service");
        }

        List<Path> implementations = javaFiles.stream()
                .filter(path -> SERVICE_IMPLEMENTATION.matcher(relative(sourceRoot, path)).find())
                .toList();
        assertThat(implementations).isNotEmpty();
        for (Path implementation : implementations) {
            assertThat(Files.readString(implementation))
                    .as("Service 实现必须由 Spring 注册并实现契约：%s", relative(sourceRoot, implementation))
                    .contains("org.springframework.stereotype.Service")
                    .contains("implements ");
        }
    }

    /**
     * 验证 Controller 源码不导入任何 Service 实现包。
     * 真实传参示例：扫描 MDA 下名称以 {@code Controller.java} 结尾的源码。
     * 真实返回示例：Controller 只出现 {@code .service.接口名} 依赖。
     * 异常或副作用示例：导入 {@code .service.impl.} 时失败；测试不修改源码。
     *
     * @throws IOException 源码读取失败时终止测试
     */
    @Test
    void controllersMustNotDependOnServiceImplementations() throws IOException {
        Path sourceRoot = locateMdaSourceRoot();
        try (Stream<Path> files = Files.walk(sourceRoot)) {
            List<Path> controllers = files
                    .filter(path -> path.getFileName().toString().endsWith("Controller.java"))
                    .toList();
            assertThat(controllers).isNotEmpty();
            for (Path controller : controllers) {
                assertThat(Files.readString(controller))
                        .as("Controller 禁止依赖 Service 实现：%s", relative(sourceRoot, controller))
                        .doesNotContain(".service.impl.");
            }
        }
    }

    /**
     * 从测试运行目录向上寻找 MDA Java 源码根。
     * 真实传参示例：读取 Gradle 测试进程的 {@code user.dir}，不接收业务参数。
     * 真实返回示例：{@code apps/mda/backend/src/main/java/com/sp/selplat/mda}。
     * 异常或副作用示例：当前目录不属于 SELPLAT 时抛出异常；不修改文件。
     *
     * @return MDA Java 源码根
     * @throws IllegalStateException 当前目录不属于 SELPLAT 时抛出
     */
    private Path locateMdaSourceRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            Path fromWorkspace = current.resolve(
                    "apps/mda/backend/src/main/java/com/sp/selplat/mda");
            if (Files.isDirectory(fromWorkspace)) {
                return fromWorkspace;
            }
            Path fromModule = current.resolve("src/main/java/com/sp/selplat/mda");
            if (Files.isDirectory(fromModule)) {
                return fromModule;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("无法定位 MDA Java 源码根。");
    }

    /**
     * 把源码绝对路径转换为稳定的正斜线相对路径。
     * 真实传参示例：源码根 {@code .../mda} 和文件 {@code .../mda/project/service/XService.java}。
     * 真实返回示例：{@code project/service/XService.java}。
     * 异常或副作用示例：文件不在源码根内时由 Path 抛出异常；不修改路径或文件。
     *
     * @param sourceRoot MDA 源码根
     * @param path 根内 Java 文件
     * @return 使用正斜线的相对路径
     */
    private String relative(Path sourceRoot, Path path) {
        return sourceRoot.relativize(path).toString().replace('\\', '/');
    }
}
