/*
 * developer-workbench/manifest.js：开发工作台主题清单。
 * 只登记深浅模式、青色强调和纯色背景，不包含 AI Desktop 页面布局或业务状态。
 */
(function selDeveloperWorkbenchThemeRegister() {
    "use strict";

    const selDeveloperWorkbenchDisplay = { overlay: 0, brightness: 100, blur: 0 };
    window.sel.theme.registry?.register({
        id: "developer-workbench",
        name: "开发工作台",
        category: "开发工具",
        description: "紧凑深色工具栏、分层蓝灰面板与青色焦点反馈",
        icon: "ri-code-box-line",
        defaults: { mode: "dark", accent: "crystal-cyan", density: "compact" },
        styles: [
            "/sel/theme/packs/developer-workbench/theme.css?v=20260823-1",
            "/sel/theme/packs/developer-workbench/modes/dark.css?v=20260823-1",
            "/sel/theme/packs/developer-workbench/modes/light.css?v=20260823-1"
        ],
        modes: [
            {
                id: "dark",
                label: "深色模式",
                themeLabel: "深空工作台",
                description: "深蓝灰工作区与青色焦点",
                icon: "ri-moon-clear-line",
                preview: { surface: "#080b12", card: "#121927", main: "#d8e0ee", muted: "#8f9cb0", accent: "#5ee8ff" },
                base: { color: "#5ee8ff", frameImage: "", backgroundTheme: "solid-dark", backgroundDisplay: selDeveloperWorkbenchDisplay },
                accents: [
                    { id: "crystal-cyan", label: "水晶青", color: "#5ee8ff", frameImage: "", backgroundTheme: "solid-dark", backgroundDisplay: selDeveloperWorkbenchDisplay }
                ]
            },
            {
                id: "light",
                label: "浅色模式",
                themeLabel: "晨光工作台",
                description: "浅灰工作区与深青焦点",
                icon: "ri-sun-line",
                preview: { surface: "#f4f7fb", card: "#ffffff", main: "#172033", muted: "#66758b", accent: "#087f95" },
                base: { color: "#087f95", frameImage: "", backgroundTheme: "solid-light", backgroundDisplay: selDeveloperWorkbenchDisplay },
                accents: [
                    { id: "crystal-cyan", label: "深海青", color: "#087f95", frameImage: "", backgroundTheme: "solid-light", backgroundDisplay: selDeveloperWorkbenchDisplay }
                ]
            }
        ]
    });
})();
