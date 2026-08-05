/*
 * crystal-tech/manifest.js：水晶科技主题包清单。
 * 一个主题同时登记深浅模式；每个模式拥有独立基础材质、颜色组合、边框与配套背景。
 */
(function selCrystalTechThemeRegister() {
    "use strict";

    const selCrystalTechAssetVersion = "20260804-1";
    const selCrystalTechFrameRoot = "/sel/assets/skins";
    const selCrystalTechBackgroundDisplay = Object.freeze({
        dark: Object.freeze({ overlay: 52, brightness: 86, blur: 0 }),
        light: Object.freeze({ overlay: 16, brightness: 96, blur: 0 })
    });

    /** 为一个明暗模式建立六组独立颜色、边框和背景映射。 */
    function selCrystalTechAccents(selCrystalTechMode) {
        const selCrystalTechDefinitions = [
            ["stellar-blue", "星际蓝", "#4A8BFF"],
            ["crystal-cyan", "水晶青", "#28D7FF"],
            ["nebula-purple", "星云紫", "#8067FF"],
            ["emerald-green", "翡翠绿", "#28C7A5"],
            ["amber-gold", "琥珀金", "#F3B348"],
            ["pulse-pink", "脉冲粉", "#EC5D9A"]
        ];
        return selCrystalTechDefinitions.map(([selCrystalTechId, selCrystalTechLabel, selCrystalTechColor]) => Object.freeze({
            id: selCrystalTechId,
            label: selCrystalTechLabel,
            color: selCrystalTechColor,
            frameImage: `${selCrystalTechFrameRoot}/${selCrystalTechMode}/components/panel/themes/selPanelFrame-${selCrystalTechId}.webp?v=${selCrystalTechAssetVersion}`,
            backgroundTheme: `${selCrystalTechMode}-${selCrystalTechId}`,
            backgroundDisplay: selCrystalTechBackgroundDisplay[selCrystalTechMode]
        }));
    }

    window.selThemeRegistry?.register({
        id: "crystal-tech",
        name: "水晶科技",
        description: "透明水晶边框、深海玻璃与蓝紫光效",
        icon: "ri-gem-line",
        defaults: Object.freeze({ mode: "dark", accent: null, density: "comfortable" }),
        modes: Object.freeze([
            Object.freeze({
                id: "dark",
                label: "深色皮肤",
                themeLabel: "深空水晶",
                description: "深色界面 · 浅色文字",
                icon: "ri-moon-clear-line",
                preview: Object.freeze({ surface: "#020816", card: "#07132E", main: "#F7FAFF", muted: "#AFC0DD", accent: "#8067FF" }),
                base: Object.freeze({
                    color: "#4A8BFF",
                    frameImage: `${selCrystalTechFrameRoot}/dark/components/panel/selPanelCyberFrame.webp?v=${selCrystalTechAssetVersion}`,
                    backgroundTheme: "void",
                    backgroundDisplay: selCrystalTechBackgroundDisplay.dark
                }),
                accents: Object.freeze(selCrystalTechAccents("dark"))
            }),
            Object.freeze({
                id: "light",
                label: "浅色皮肤",
                themeLabel: "晨雾水晶",
                description: "浅色界面 · 深色文字",
                icon: "ri-sun-line",
                preview: Object.freeze({ surface: "#EAF3FB", card: "#DCE8F3", main: "#0B1633", muted: "#52617A", accent: "#4A8BFF" }),
                base: Object.freeze({
                    color: "#3670B0",
                    frameImage: `${selCrystalTechFrameRoot}/light/components/panel/selPanelLightCrystalFrame.webp?v=${selCrystalTechAssetVersion}`,
                    backgroundTheme: "morning-mist",
                    backgroundDisplay: selCrystalTechBackgroundDisplay.light
                }),
                accents: Object.freeze(selCrystalTechAccents("light"))
            })
        ])
    });
})();
