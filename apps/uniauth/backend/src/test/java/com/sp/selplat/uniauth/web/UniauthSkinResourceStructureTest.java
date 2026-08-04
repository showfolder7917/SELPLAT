package com.sp.selplat.uniauth.web;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
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
