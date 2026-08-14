/*
 * glass-admin/manifest.js：晶透管理通用主题清单。
 * 一个主题同时提供深浅模式；每个模式包含基础外观和六组颜色背景，因此固定形成七套可选皮肤。
 */
(function selGlassAdminThemeRegister() {
    "use strict";

    const selGlassAdminBackgroundDisplay = {
        dark: { overlay: 0, brightness: 100, blur: 0 },
        light: { overlay: 0, brightness: 100, blur: 0 }
    };
    const selGlassAdminAccentDefinitions = {
        dark: [
            ["stellar-blue", "星际蓝", "#4A8BFF"],
            ["crystal-cyan", "水晶青", "#28C7D8"],
            ["nebula-purple", "星云紫", "#8067FF"],
            ["emerald-green", "翡翠绿", "#28B890"],
            ["amber-gold", "琥珀金", "#E0A13A"],
            ["pulse-pink", "脉冲粉", "#DD5A91"]
        ],
        light: [
            ["stellar-blue", "星际蓝", "#3976BE"],
            ["crystal-cyan", "水晶青", "#168B9C"],
            ["nebula-purple", "星云紫", "#6C55C7"],
            ["emerald-green", "翡翠绿", "#18866F"],
            ["amber-gold", "琥珀金", "#A96813"],
            ["pulse-pink", "脉冲粉", "#B74776"]
        ]
    };

    /** 为指定模式建立六组颜色与配套背景；空边框表示使用 CSS 玻璃描边。 */
    function selGlassAdminAccents(selGlassAdminMode) {
        return selGlassAdminAccentDefinitions[selGlassAdminMode].map(([selGlassAdminId, selGlassAdminLabel, selGlassAdminColor]) => ({
            id: selGlassAdminId,
            label: selGlassAdminLabel,
            color: selGlassAdminColor,
            frameImage: "",
            backgroundTheme: `solid-${selGlassAdminMode}`,
            backgroundDisplay: selGlassAdminBackgroundDisplay[selGlassAdminMode]
        }));
    }

    window.sel.theme.registry?.register({
        id: "glass-admin",
        name: "晶透管理",
        category: "管理",
        description: "轻量玻璃、柔和圆角与清晰的数据管理界面",
        icon: "ri-layout-grid-line",
        defaults: { mode: "dark", accent: "crystal-cyan", density: "comfortable" },
        styles: [
            "/sel/theme/packs/glass-admin/theme.css?v=20260807-1",
            "/sel/theme/packs/glass-admin/modes/dark.css?v=20260807-1",
            "/sel/theme/packs/glass-admin/modes/light.css?v=20260807-1"
        ],
        modes: [
            {
                id: "dark",
                label: "深色皮肤",
                themeLabel: "深海晶透",
                description: "深色玻璃 · 清晰浅色文字",
                icon: "ri-moon-clear-line",
                preview: { surface: "#061126", card: "#0C1C38", main: "#EEF6FF", muted: "#98A9C8", accent: "#28C7D8" },
                base: { color: "#5D8FC9", frameImage: "", backgroundTheme: "solid-dark", backgroundDisplay: selGlassAdminBackgroundDisplay.dark },
                accents: selGlassAdminAccents("dark")
            },
            {
                id: "light",
                label: "浅色皮肤",
                themeLabel: "晨光晶透",
                description: "浅色玻璃 · 稳定深色文字",
                icon: "ri-sun-line",
                preview: { surface: "#EDF4FB", card: "#F8FBFF", main: "#17243D", muted: "#5B6A82", accent: "#3976BE" },
                base: { color: "#58789C", frameImage: "", backgroundTheme: "solid-light", backgroundDisplay: selGlassAdminBackgroundDisplay.light },
                accents: selGlassAdminAccents("light")
            }
        ]
    });
})();
