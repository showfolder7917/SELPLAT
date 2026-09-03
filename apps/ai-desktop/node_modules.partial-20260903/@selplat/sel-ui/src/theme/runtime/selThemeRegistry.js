/*
 * selThemeRegistry.js：SEL 主题包注册表。
 * 负责校验并保存主题、明暗模式、各模式颜色与素材清单，不操作页面 DOM 或业务组件。
 * 模块级 JavaScript 标识统一使用 selThemeRegistry 前缀，公开注册表为 window.sel.theme.registry。
 */
(function selThemeRegistryInitialize() {
    "use strict";

    const selFreeze = window.sel.core.freeze;

    // 注册表只保存经过完整校验的主题快照，避免主题包在注册后继续修改运行契约。
    const selThemeRegistryThemes = new Map();
    // 纯色背景不对应位图，是唯一允许跨主题使用的背景 ID。
    const selThemeRegistrySolidBackgroundIds = new Set(["solid-dark", "solid-light"]);

    /**
     * 校验主题包的最小运行契约。
     * @param {object} selThemeRegistryTheme - 主题包 manifest。
     * @returns {boolean} true 表示主题可以安全注册。
     */
    function selThemeRegistryValidate(selThemeRegistryTheme) {
        if (!selThemeRegistryTheme || typeof selThemeRegistryTheme !== "object" || !/^[a-z][a-z0-9-]*$/.test(selThemeRegistryTheme.id || "")) {
            return false;
        }
        if (typeof selThemeRegistryTheme.name !== "string" || !Array.isArray(selThemeRegistryTheme.modes) || selThemeRegistryTheme.modes.length === 0) {
            return false;
        }
        // 主题自动背景必须由自己的 manifest 登记，且图片路径只能指向同名主题素材目录。
        const selThemeRegistryBackgroundIds = new Set();
        for (const selThemeRegistryBackground of selThemeRegistryTheme.backgrounds || []) {
            const selThemeRegistryBackgroundId = selThemeRegistryBackground?.id || "";
            const selThemeRegistryBackgroundImage = selThemeRegistryBackground?.image || "";
            if (!/^[a-z][a-z0-9-]*$/.test(selThemeRegistryBackgroundId)
                || selThemeRegistryBackgroundIds.has(selThemeRegistryBackgroundId)
                || typeof selThemeRegistryBackground?.name !== "string"
                || typeof selThemeRegistryBackground?.category !== "string"
                || typeof selThemeRegistryBackground?.image !== "string"
                || !selThemeRegistryBackgroundImage.includes(`/assets/themes/${selThemeRegistryTheme.id}/`)) {
                return false;
            }
            selThemeRegistryBackgroundIds.add(selThemeRegistryBackgroundId);
        }
        const selThemeRegistryOwnsBackground = (selThemeRegistryBackgroundId) => selThemeRegistrySolidBackgroundIds.has(selThemeRegistryBackgroundId)
            || selThemeRegistryBackgroundIds.has(selThemeRegistryBackgroundId);
        const selThemeRegistryModeIds = new Set();
        for (const selThemeRegistryMode of selThemeRegistryTheme.modes) {
            if (!selThemeRegistryMode || !/^[a-z][a-z0-9-]*$/.test(selThemeRegistryMode.id || "") || selThemeRegistryModeIds.has(selThemeRegistryMode.id)) {
                return false;
            }
            selThemeRegistryModeIds.add(selThemeRegistryMode.id);
            if (!selThemeRegistryMode.base || !selThemeRegistryOwnsBackground(selThemeRegistryMode.base.backgroundTheme) || !Array.isArray(selThemeRegistryMode.accents)) {
                return false;
            }
            const selThemeRegistryAccentIds = new Set();
            for (const selThemeRegistryAccent of selThemeRegistryMode.accents) {
                if (!selThemeRegistryAccent || !/^[a-z][a-z0-9-]*$/.test(selThemeRegistryAccent.id || "") || selThemeRegistryAccentIds.has(selThemeRegistryAccent.id) || typeof selThemeRegistryAccent.color !== "string" || !selThemeRegistryOwnsBackground(selThemeRegistryAccent.backgroundTheme)) {
                    return false;
                }
                selThemeRegistryAccentIds.add(selThemeRegistryAccent.id);
            }
        }
        // 一个完整主题必须同时拥有深色和浅色模式，默认模式也必须来自该主题自身。
        return selThemeRegistryModeIds.has("dark")
            && selThemeRegistryModeIds.has("light")
            && selThemeRegistryModeIds.has(selThemeRegistryTheme.defaults?.mode);
    }

    // 公开 API 只允许显式注册、读取和枚举主题，不根据文件名或目录自动推断。
    window.sel.register("theme.registry", {
        register(selThemeRegistryTheme) {
            if (!selThemeRegistryValidate(selThemeRegistryTheme) || selThemeRegistryThemes.has(selThemeRegistryTheme.id)) {
                return false;
            }
            // 主题定义只在进入注册表时形成一次深只读快照，manifest 内部不再逐层重复冻结。
            selThemeRegistryThemes.set(selThemeRegistryTheme.id, selFreeze(selThemeRegistryTheme));
            return true;
        },
        get: (selThemeRegistryThemeId) => selThemeRegistryThemes.get(selThemeRegistryThemeId) || null,
        has: (selThemeRegistryThemeId) => selThemeRegistryThemes.has(selThemeRegistryThemeId),
        list: () => selFreeze(Array.from(selThemeRegistryThemes.values()))
    });
})();
