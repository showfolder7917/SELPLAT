/*
 * plain-minimal/manifest.js：普通极简主题清单。
 * 主题仅使用系统字体、纯色背景和黑白灰令牌，不加载图片、光效或装饰性素材。
 */
(function selPlainMinimalThemeRegister() {
    "use strict";

    const selPlainMinimalDisplay = { overlay: 0, brightness: 100, blur: 0 };
    window.sel.theme.registry?.register({
        id: "plain-minimal",
        name: "普通极简",
        category: "办公",
        description: "白底黑字、直角细边框的普通办公网页",
        icon: "ri-file-text-line",
        defaults: { mode: "light", accent: null, density: "compact" },
        styles: [
            "/sel/theme/packs/plain-minimal/theme.css?v=20260820-2",
            "/sel/theme/packs/plain-minimal/modes/dark.css?v=20260820-2",
            "/sel/theme/packs/plain-minimal/modes/light.css?v=20260820-2"
        ],
        modes: [
            {
                id: "dark",
                label: "深色模式",
                themeLabel: "普通深色",
                description: "深灰底和浅灰文字",
                icon: "ri-moon-line",
                preview: { surface: "#202020", card: "#292929", main: "#f2f2f2", muted: "#b8b8b8", accent: "#d0d0d0" },
                base: { color: "#a0a0a0", frameImage: "", backgroundTheme: "solid-dark", backgroundDisplay: selPlainMinimalDisplay },
                accents: []
            },
            {
                id: "light",
                label: "浅色模式",
                themeLabel: "普通网页",
                description: "白底、黑字和灰色细边框",
                icon: "ri-sun-line",
                preview: { surface: "#ffffff", card: "#ffffff", main: "#111111", muted: "#666666", accent: "#333333" },
                base: { color: "#444444", frameImage: "", backgroundTheme: "solid-light", backgroundDisplay: selPlainMinimalDisplay },
                accents: []
            }
        ]
    });
})();
