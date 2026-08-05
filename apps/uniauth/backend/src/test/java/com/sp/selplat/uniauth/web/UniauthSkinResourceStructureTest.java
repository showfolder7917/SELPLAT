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
        // 根节点必须提供确定默认皮肤，刷新后不依赖脚本执行时序猜测明暗。
        assertTrue(html.contains("data-sel-skin=\"dark\""));
        // 深浅皮肤均从独立 skin 文件进入，组件 CSS 仍只加载一次。
        assertTrue(html.contains("../sel/theme/skins/selSkinDark.css"));
        assertTrue(html.contains("../sel/theme/skins/selSkinLight.css"));
        // 旧材质位置已由 skin 目录替代，禁止继续保留第二条兼容路径。
        assertFalse(html.contains("assets/components/panel/selPanelCyberFrame.webp"));
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
        assertTrue(script.contains("深色主题"));
        assertTrue(script.contains("浅色主题"));
        assertTrue(script.contains("深浅各 7 套"));
        // 顶部卡片只表达明暗切换，具体基础主题名称只能出现在下方主题入口。
        assertTrue(script.contains("label: \"深色皮肤\", themeLabel: \"深空水晶\""));
        assertTrue(script.contains("label: \"浅色皮肤\", themeLabel: \"晨雾水晶\""));
        assertTrue(script.contains("选择界面明暗"));
        assertTrue(script.contains("保留当前主题配色"));
        // 每行首项必须恢复该皮肤的原始边框和背景，不能伪装成第七套重复配色素材。
        assertTrue(script.contains("dataset.selPersonalThemeBase = \"true\""));
        assertTrue(script.contains("selPersonalizationBaseTheme"));
        assertTrue(script.contains("themeColor: selPersonalizationRequestedColor"));
        assertFalse(script.contains("data-sel-personal-theme-swatches"));
        // 两张基础皮肤卡使用固定预览色，不能被当前统一主题色重新染色。
        assertTrue(script.contains("--selpersonal-skin-preview-surface"));
        assertTrue(script.contains("--selpersonal-skin-preview-accent"));
        // 公开方法需要在换肤后继续同步面板与文字，因此验证包装方法及其真实皮肤调用，而不是旧式直接引用。
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
        String typographyCss = readText("static/sel/theme/selThemeTypography.css");
        String personalizationCss = readText("static/sel/components/personalization/selPersonalization.css");
        // 字体族和字号比例必须由页面级令牌提供，组件不得各自形成孤立开关。
        assertTrue(tokensCss.contains("--sel-theme-font-family:"));
        assertTrue(tokensCss.contains("--sel-theme-font-scale: 1"));
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
        String personalizationScript = readText("static/sel/components/personalization/selPersonalization.js");
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
                // 页面背景注册表必须同时包含深浅主题 ID，确保色块点击能够成功切换配套图片。
                assertTrue(backgroundScript.contains("id: \"" + skin + "-" + themeId + "\""));
            }
            // 个性化脚本使用统一路径解析器消费当前皮肤，避免为 12 张边框复制事件分支。
            assertTrue(personalizationScript.contains("${selPersonalizationSkin.id}/components/panel/themes/selPanelFrame-"));
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
