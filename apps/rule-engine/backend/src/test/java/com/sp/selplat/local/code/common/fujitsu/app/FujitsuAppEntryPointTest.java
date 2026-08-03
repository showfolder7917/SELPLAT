package com.sp.selplat.local.code.common.fujitsu.app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.local.code.common.fujitsu.app.db.DBデータ生成ツール;
import com.sp.selplat.local.code.common.fujitsu.app.sql.GenericSqlSpecDocCorrector;
import com.sp.selplat.local.code.common.fujitsu.app.sql.SQL仕様書生成ツール;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 验证 Fujitsu app 下的完整程序拥有可供人工命令和 AI 共同调用的公开 main 入口。
 */
class FujitsuAppEntryPointTest {

    /**
     * DB、SQL 生成和 SQL 修正程序必须全部位于 app 包并暴露标准 main。
     *
     * @throws NoSuchMethodException 任一程序缺少 `main(String[])`
     */
    @Test
    void shouldExposeManualAndAiCallableMainEntries() throws NoSuchMethodException {
        // 三个已核验完整程序形成当前 Fujitsu app 清单，新增入口必须显式加入验证。
        List<Class<?>> appClasses = List.of(
            DBデータ生成ツール.class,
            SQL仕様書生成ツール.class,
            GenericSqlSpecDocCorrector.class
        );
        // 逐个确认包边界和 Java 标准入口，防止迁移后只移动文件却留下旧包名或私有方法。
        for (Class<?> appClass : appClasses) {
            // 所有完整程序必须归入 Fujitsu app 子包。
            assertTrue(appClass.getPackageName().startsWith(
                "com.sp.selplat.local.code.common.fujitsu.app."
            ));
            // 人工和 AI 均通过相同的 main(String[]) 调用程序。
            Method mainMethod = appClass.getMethod("main", String[].class);
            // Java 命令入口必须公开。
            assertTrue(Modifier.isPublic(mainMethod.getModifiers()));
            // Java 命令入口必须静态，无需构造带状态实例。
            assertTrue(Modifier.isStatic(mainMethod.getModifiers()));
            // 标准 main 不返回业务对象，运行结果通过文件、日志和退出状态表达。
            assertEquals(void.class, mainMethod.getReturnType());
        }
    }

    /**
     * SQL 生成 app 无参数运行时必须命中迁移后的真实规则包配置。
     *
     * @throws Exception 反射入口或默认配置解析失败
     */
    @Test
    void shouldResolveSqlGeneratorDefaultConfigFromCurrentRulePackage() throws Exception {
        // 通过真实私有定位逻辑取得默认配置，避免测试复制一份路径常量。
        Method locator = SQL仕様書生成ツール.class.getDeclaredMethod("locateDefaultConfig");
        // 测试只读取路径结果，不改变生产方法可见性。
        locator.setAccessible(true);
        // 无参数人工运行和 AI 调用共享这份默认 JSON。
        Path configPath = (Path) locator.invoke(null);
        // 配置必须位于当前分层后的 Fujitsu 规则模板包。
        assertTrue(configPath.toString().contains(
            "local/common/fujitsu/通用/template/RUL_FujitsuSQL规格书Excel生成规则"
        ));
        // 真实文件存在才说明 main 无参数入口没有继续引用废弃资源路径。
        assertTrue(Files.isRegularFile(configPath));
    }
}
