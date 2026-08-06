package com.sp.selplat.uniauth.web;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Uniauth 皮肤资源结构测试验证组件共用、皮肤分层、独立 Tab 和真实材质保持同一运行契约。
 */
class UniauthSkinResourceStructureTest {

    /**
     * skinResources 验证页面只加载一套组件，同时加载独立深浅皮肤入口。
     */
    @Test
    void skinResources() throws IOException {
        // 读取真实应用入口，避免测试复制资源路径后掩盖页面漏装配。
        String html = readText("static/uniauth/uniauth.html");
        // 根节点必须显式声明四个独立主题维度，刷新后不依赖脚本时序猜测默认状态。
        assertTrue(html.contains("data-sel-theme=\"crystal-tech\""));
        assertTrue(html.contains("data-sel-mode=\"dark\""));
        assertTrue(html.contains("data-sel-accent=\"base\""));
        assertTrue(html.contains("data-sel-density=\"comfortable\""));
        // 页面先加载主题契约，再加载当前主题包的深浅模式和运行管理器。
        assertTrue(html.contains("../sel/theme/contract/selThemeContract.css"));
        assertTrue(html.contains("../sel/theme/packs/crystal-tech/modes/dark.css"));
        assertTrue(html.contains("../sel/theme/packs/crystal-tech/modes/light.css"));
        assertTrue(html.contains("../sel/theme/packs/candy-adventure/modes/dark.css"));
        assertTrue(html.contains("../sel/theme/packs/candy-adventure/modes/light.css"));
        assertTrue(html.contains("../sel/theme/runtime/selThemeRegistry.js"));
        assertTrue(html.contains("../sel/theme/packs/crystal-tech/manifest.js"));
        assertTrue(html.contains("../sel/theme/packs/candy-adventure/manifest.js"));
        assertTrue(html.contains("../sel/theme/runtime/selThemeManager.js"));
        assertFalse(html.contains("../sel/theme/skins/"));
    }

    /**
     * personalizationSkinTab 验证皮肤与背景、面板、文字保持独立一级职责。
     */
    @Test
    void personalizationSkinTab() throws IOException {
        // 直接检查生产脚本的稳定数据属性和公开状态，不依赖压缩后偶然文本。
        String script = readText("static/sel/components/personalization/selPersonalization.js");
        assertTrue(script.contains("data-sel-personal-tab=\"skin\""));
        assertTrue(script.contains("data-sel-personal-view=\"skin\""));
        assertTrue(script.contains("skin: selPersonalizationSkinState"));
        // 十四套主题必须在皮肤页按深浅行呈现，面板页不再生成第二套常用色入口。
        assertTrue(script.contains("data-sel-personal-skin-themes"));
        assertTrue(script.contains("dataset.selPersonalThemeSkin"));
        assertTrue(script.contains("data-sel-personal-theme-grid"));
        assertTrue(script.contains("selPersonalizationThemeManager.getTheme()"));
        assertTrue(script.contains("selPersonalizationSkin.accents.forEach"));
        // 风格、明暗和颜色分别来自注册表，个性化脚本不能再内置水晶主题名称或素材路径。
        assertTrue(script.contains("选择主题风格"));
        assertTrue(script.contains("一个主题包含深浅皮肤与独立配色"));
        assertFalse(script.contains("label: \"深色皮肤\", themeLabel: \"深空水晶\""));
        assertFalse(script.contains("/sel/assets/skins/dark/"));
        assertTrue(script.contains("选择界面明暗"));
        assertTrue(script.contains("保留当前主题配色"));
        // 每行首项必须恢复该皮肤的原始边框和背景，不能伪装成第七套重复配色素材。
        assertTrue(script.contains("dataset.selPersonalThemeBase = \"true\""));
        assertTrue(script.contains("selPersonalizationBaseTheme"));
        assertTrue(script.contains("themeAccent: selPersonalizationRequestedAccent"));
        assertFalse(script.contains("data-sel-personal-theme-swatches"));
        // 皮肤卡使用 manifest 固定预览色，不能被当前统一主题色重新染色。
        assertTrue(script.contains("--selpersonal-skin-preview-surface"));
        assertTrue(script.contains("--selpersonal-skin-preview-accent"));
        // 公开方法需要在换肤后继续同步面板与文字，因此验证包装方法及其真实皮肤调用，而不是旧式直接引用。
        assertTrue(script.contains("setTheme(selPersonalizationThemeId)"));
        assertTrue(script.contains("setMode(selPersonalizationModeId)"));
        assertTrue(script.contains("setSkin(selPersonalizationSkinId)"));
        assertTrue(script.contains("selPersonalizationApplySkin(selPersonalizationSkinId)"));
    }

    /**
     * gridSelectionCheckmarkToken 验证表格对勾跟随深浅皮肤的选中表面文字令牌。
     */
    @Test
    void gridSelectionCheckmarkToken() throws IOException {
        String gridCss = readText("static/sel/components/grid/selGrid.css");
        assertTrue(gridCss.contains("border-bottom: 2px solid var(--sel-theme-text-on-selected-surface)"));
        assertTrue(gridCss.contains("border-left: 2px solid var(--sel-theme-text-on-selected-surface)"));
        assertFalse(gridCss.contains("border-bottom: 2px solid white"));
        assertFalse(gridCss.contains("border-left: 2px solid white"));
    }

    /**
     * typographyTokens 验证业务文字与个性化设置自身共同消费字体族和字号令牌。
     */
    @Test
    void typographyTokens() throws IOException {
        String tokensCss = readText("static/sel/theme/selThemeTokens.css");
        String contractCss = readText("static/sel/theme/contract/selThemeContract.css");
        String typographyCss = readText("static/sel/theme/selThemeTypography.css");
        String personalizationCss = readText("static/sel/components/personalization/selPersonalization.css");
        // 字体族和字号比例必须由页面级令牌提供，组件不得各自形成孤立开关。
        assertTrue(tokensCss.contains("--sel-theme-font-family:"));
        assertTrue(tokensCss.contains("--sel-theme-font-scale: 1"));
        assertTrue(contractCss.contains("../selThemeTokens.css"));
        assertTrue(typographyCss.contains("font-family: var(--sel-theme-font-family)"));
        // 表头、数据单元格、树节点和个性化设置标签必须位于同一字号适配层。
        assertTrue(typographyCss.contains(".selgrid-table th"));
        assertTrue(typographyCss.contains(".selgrid-table td"));
        assertTrue(typographyCss.contains(".seltree-node-row"));
        assertTrue(typographyCss.contains(".selpersonal-panel-range-copy strong"));
        assertTrue(typographyCss.contains(".selpersonal-text-mode"));
        assertTrue(typographyCss.contains("calc(14px * var(--sel-theme-font-scale))"));
        // 个性化面板不能继续绑定旧表格私有字体，避免用户改变字体时设置面板自身不响应。
        assertTrue(personalizationCss.contains("var(--sel-theme-font-family"));
    }

    /**
     * componentGeometryTokens 验证公共组件消费统一几何令牌，主题与用户调节各自保持责任边界。
     */
    @Test
    void componentGeometryTokens() throws IOException {
        String tokensCss = readText("static/sel/theme/selThemeTokens.css");
        String gridCss = readText("static/sel/components/grid/selGrid.css");
        String treeCss = readText("static/sel/components/tree/selTree.css");
        String personalizationScript = readText("static/sel/components/personalization/selPersonalization.js");
        String crystalTheme = readText("static/sel/theme/packs/crystal-tech/theme.css");
        String candyTheme = readText("static/sel/theme/packs/candy-adventure/theme.css");
        // 主题基准与用户偏移必须分离，防止切换主题后被固定的水晶圆角覆盖。
        assertTrue(tokensCss.contains("--sel-theme-radius-panel-base:"));
        assertTrue(tokensCss.contains("--selpersonal-radius-panel-offset:"));
        assertTrue(tokensCss.contains("calc(var(--sel-theme-radius-panel-base) + var(--selpersonal-radius-panel-offset))"));
        assertTrue(personalizationScript.contains("--selpersonal-radius-panel-offset"));
        assertFalse(personalizationScript.contains("setProperty(\"--sel-theme-radius-panel\""));
        // 表格和树形组件只能读取组件语义令牌，不再固定水晶主题的像素圆角。
        assertTrue(gridCss.contains("border-radius: var(--sel-theme-grid-radius-board)"));
        assertTrue(gridCss.contains("border-radius: var(--sel-theme-grid-radius-content)"));
        assertTrue(gridCss.contains("border-spacing: 0 var(--sel-theme-grid-row-gap)"));
        assertTrue(treeCss.contains("border-radius: var(--sel-theme-tree-node-radius)"));
        assertFalse(gridCss.contains(".selgrid-board-shell {\n    position: relative;\n    width: 100%;\n    min-width: 0;\n    height: 100%;\n    min-height: 390px;\n    overflow: hidden;\n    border-radius: 18px;"));
        // 两个主题分别登记组件几何；糖果主题还必须拥有独立卡片行造型。
        assertTrue(crystalTheme.contains("--sel-theme-radius-panel-base: 24px"));
        assertTrue(candyTheme.contains("--sel-theme-radius-panel-base: 28px"));
        assertTrue(candyTheme.contains("--sel-theme-grid-row-gap: 6px"));
        assertTrue(candyTheme.contains(".selgrid-table tbody td:first-child"));
        assertTrue(candyTheme.contains(".seltree-node-row.seltree-node-selected"));
    }

    /**
     * textScaleKeepsSkinFollowing 验证字号和对比覆盖不再把颜色模式误切成自定义。
     */
    @Test
    void textScaleKeepsSkinFollowing() throws IOException {
        String script = readText("static/sel/components/personalization/selPersonalization.js");
        // 两个排版参数分别记录覆盖状态，换肤时只保留用户调整过的滑杆值。
        assertTrue(script.contains("contrastOverride: false"));
        assertTrue(script.contains("fontScaleOverride: false"));
        assertTrue(script.contains("const selPersonalizationTextOverrideKey = `${selPersonalizationTextKey}Override`"));
        assertTrue(script.contains("[selPersonalizationTextOverrideKey]: true"));
        // 应用文字时必须分别判断覆盖状态，不能再用颜色 custom 模式承载字号和对比变化。
        assertTrue(script.contains("selPersonalizationTextState.contrastOverride"));
        assertTrue(script.contains("selPersonalizationTextState.fontScaleOverride"));
        assertFalse(script.contains("[selPersonalizationTextKey]: selPersonalizationClamp(selPersonalizationTextRange.value, selPersonalizationTextDefaults[selPersonalizationTextKey]), mode: \"custom\""));
    }

    /**
     * skinMaterials 验证两套皮肤都引用真实且非空的 WebP 九宫格素材。
     */
    @Test
    void skinMaterials() throws IOException {
        // 深色皮肤继续使用迁移后的现行材质，不复制旧路径。
        byte[] darkFrame = readBytes("static/sel/assets/skins/dark/components/panel/selPanelCyberFrame.webp");
        // 浅色皮肤必须交付配套真实素材，禁止用空文件或 CSS 占位。
        byte[] lightFrame = readBytes("static/sel/assets/skins/light/components/panel/selPanelLightCrystalFrame.webp");
        // 纯黑深空必须是正式图片主题，浅色皮肤选择时不得回退页面基础底色。
        byte[] darkSpaceBackground = readBytes("static/sel/assets/backgrounds/dark-void-deep-space.webp");
        assertTrue(darkFrame.length > 10_000);
        assertTrue(lightFrame.length > 10_000);
        assertTrue(darkSpaceBackground.length > 10_000);
        // WebP 文件以 RIFF 开头；快速头校验可阻断扩展名正确但内容损坏的资源。
        assertTrue(new String(darkFrame, 0, 4, StandardCharsets.US_ASCII).equals("RIFF"));
        assertTrue(new String(lightFrame, 0, 4, StandardCharsets.US_ASCII).equals("RIFF"));
        assertTrue(new String(darkSpaceBackground, 0, 4, StandardCharsets.US_ASCII).equals("RIFF"));
    }

    /**
     * themeColorMaterialPacks 验证六个色板在深浅皮肤下都有独立边框与配套背景。
     */
    @Test
    void themeColorMaterialPacks() throws IOException {
        // 稳定主题 ID 与生产脚本一致，新增或删除色板时必须原子更新完整素材包。
        List<String> themeIds = List.of(
                "stellar-blue", "crystal-cyan", "nebula-purple", "emerald-green", "amber-gold", "pulse-pink");
        String themeManifest = readText("static/sel/theme/packs/crystal-tech/manifest.js");
        String themeManager = readText("static/sel/theme/runtime/selThemeManager.js");
        String backgroundScript = readText("static/sel/components/page-background/selPageBackground.js");
        for (String skin : List.of("dark", "light")) {
            for (String themeId : themeIds) {
                // 边框与背景均必须为可读取的真实 WebP，禁止仅登记令牌或空占位文件。
                byte[] frame = readBytes("static/sel/assets/skins/" + skin
                        + "/components/panel/themes/selPanelFrame-" + themeId + ".webp");
                byte[] background = readBytes("static/sel/assets/backgrounds/themes/" + skin + "-" + themeId + ".webp");
                assertTrue(frame.length > 10_000);
                assertTrue(background.length > 10_000);
                assertTrue(new String(frame, 0, 4, StandardCharsets.US_ASCII).equals("RIFF"));
                assertTrue(new String(background, 0, 4, StandardCharsets.US_ASCII).equals("RIFF"));
                // 页面背景与主题 manifest 必须同时登记深浅资源，确保色块切换到对应模式素材。
                assertTrue(backgroundScript.contains("id: \"" + skin + "-" + themeId + "\""));
                assertTrue(themeManifest.contains("`${selCrystalTechMode}-${selCrystalTechId}`"));
            }
        }
        // 主题管理器按 Accent ID 从当前模式解析颜色与素材，组件和个性化脚本不再拼接路径。
        assertTrue(themeManager.contains("selThemeManagerMode.accents.find"));
        assertTrue(themeManager.contains("selThemeManagerMaterial.frameImage"));
    }

    /**
     * candyAdventureThemePack 验证儿童主题拥有独立深浅图片包和各模式可读配色。
     */
    @Test
    void candyAdventureThemePack() throws IOException {
        String manifest = readText("static/sel/theme/packs/candy-adventure/manifest.js");
        String darkCss = readText("static/sel/theme/packs/candy-adventure/modes/dark.css");
        String lightCss = readText("static/sel/theme/packs/candy-adventure/modes/light.css");
        String backgroundScript = readText("static/sel/components/page-background/selPageBackground.js");
        // 主题必须保持同一稳定 ID，并提供深浅两套相同语义、不同数值的 Accent。
        assertTrue(manifest.contains("id: \"candy-adventure\""));
        for (String accentId : List.of("sky-blue", "mint-green", "grape-purple", "sunshine-yellow", "peach-orange", "berry-pink")) {
            assertTrue(manifest.contains("[\"" + accentId + "\""));
        }
        assertTrue(manifest.contains("#6BA8FF"));
        assertTrue(manifest.contains("#3478C9"));
        assertTrue(backgroundScript.contains("selPageBackgroundThemePack.backgrounds"));
        assertTrue(manifest.contains("/${selCandyAdventureMode}/accents/${selCandyAdventureId}-frame.webp"));
        assertTrue(manifest.contains("candy-adventure-${selCandyAdventureMode}-${selCandyAdventureId}"));
        // 深浅文字颜色必须由主题模式令牌提供，不能沿用水晶主题的白字覆盖。
        assertTrue(darkCss.contains("--sel-theme-text-main: #fff9ee"));
        assertTrue(lightCss.contains("--sel-theme-text-main: #25324a"));
        // 两种模式分别拥有正式背景和透明卡通边框 WebP。
        for (String mode : List.of("dark", "light")) {
            byte[] background = readBytes("static/sel/assets/themes/candy-adventure/" + mode + "/background.webp");
            byte[] frame = readBytes("static/sel/assets/themes/candy-adventure/" + mode + "/frame.webp");
            assertTrue(background.length > 50_000);
            assertTrue(frame.length > 50_000);
            assertTrue(new String(background, 0, 4, StandardCharsets.US_ASCII).equals("RIFF"));
            assertTrue(new String(frame, 0, 4, StandardCharsets.US_ASCII).equals("RIFF"));
            assertTrue(manifest.contains("id: \"candy-adventure-" + mode + "\""));
            // 六个 Accent 必须各自交付背景和边框，不能继续共享模式基础图片。
            for (String accentId : List.of("sky-blue", "mint-green", "grape-purple", "sunshine-yellow", "peach-orange", "berry-pink")) {
                byte[] accentBackground = readBytes("static/sel/assets/themes/candy-adventure/" + mode
                        + "/accents/" + accentId + "-background.webp");
                byte[] accentFrame = readBytes("static/sel/assets/themes/candy-adventure/" + mode
                        + "/accents/" + accentId + "-frame.webp");
                assertTrue(accentBackground.length > 20_000);
                assertTrue(accentFrame.length > 50_000);
                assertTrue(new String(accentBackground, 0, 4, StandardCharsets.US_ASCII).equals("RIFF"));
                assertTrue(new String(accentFrame, 0, 4, StandardCharsets.US_ASCII).equals("RIFF"));
            }
        }
    }

    /**
     * 完整读取一个 UTF-8 classpath 文本资源。
     */
    private String readText(String resourcePath) throws IOException {
        return new String(readBytes(resourcePath), StandardCharsets.UTF_8);
    }

    /**
     * 完整读取真实 classpath 资源，缺失时立即给出具体路径。
     */
    private byte[] readBytes(String resourcePath) throws IOException {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(resourcePath)) {
            assertNotNull(inputStream, "Missing skin resource: " + resourcePath);
            return inputStream.readAllBytes();
        }
    }
}
