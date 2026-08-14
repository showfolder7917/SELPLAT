/*
 * candy-adventure/manifest.js：糖果冒险主题包清单。
 * 深色星空乐园与浅色糖果晴空分别声明可读颜色、卡通边框和独立背景素材。
 */
(function selCandyAdventureThemeRegister() {
    "use strict";

    const selCandyAdventureAssetVersion = "20260807-3";
    const selCandyAdventureAssetRoot = "/sel/assets/themes/candy-adventure";
    const selCandyAdventureModeSettings = {
        dark: {
            frameImage: `${selCandyAdventureAssetRoot}/dark/base/frame.webp?v=${selCandyAdventureAssetVersion}`,
            backgroundTheme: "candy-adventure-dark",
            backgroundDisplay: { overlay: 42, brightness: 92, blur: 0 }
        },
        light: {
            frameImage: `${selCandyAdventureAssetRoot}/light/base/frame.webp?v=${selCandyAdventureAssetVersion}`,
            backgroundTheme: "candy-adventure-light",
            backgroundDisplay: { overlay: 12, brightness: 96, blur: 0 }
        }
    };
    const selCandyAdventureAccentDefinitions = {
        dark: [
            ["sky-blue", "天空蓝", "#6BA8FF"],
            ["mint-green", "薄荷绿", "#54D6BC"],
            ["grape-purple", "葡萄紫", "#A784FF"],
            ["sunshine-yellow", "阳光黄", "#FFD166"],
            ["peach-orange", "蜜桃橙", "#FF9F68"],
            ["berry-pink", "莓果粉", "#FF6FAE"]
        ],
        light: [
            ["sky-blue", "天空蓝", "#3478C9"],
            ["mint-green", "薄荷绿", "#168C78"],
            ["grape-purple", "葡萄紫", "#7650C6"],
            ["sunshine-yellow", "阳光黄", "#B87300"],
            ["peach-orange", "蜜桃橙", "#D96736"],
            ["berry-pink", "莓果粉", "#C94C85"]
        ]
    };

    /** 同一个 Accent ID 在深浅模式下分别读取颜色、边框和背景图片。 */
    function selCandyAdventureAccents(selCandyAdventureMode) {
        const selCandyAdventureModeSetting = selCandyAdventureModeSettings[selCandyAdventureMode];
        return selCandyAdventureAccentDefinitions[selCandyAdventureMode].map(([selCandyAdventureId, selCandyAdventureLabel, selCandyAdventureColor]) => ({
            id: selCandyAdventureId,
            label: selCandyAdventureLabel,
            color: selCandyAdventureColor,
            frameImage: `${selCandyAdventureAssetRoot}/${selCandyAdventureMode}/accents/${selCandyAdventureId}/frame.webp?v=${selCandyAdventureAssetVersion}`,
            backgroundTheme: `candy-adventure-${selCandyAdventureMode}-${selCandyAdventureId}`,
            backgroundDisplay: selCandyAdventureModeSetting.backgroundDisplay
        }));
    }

    /** 把每个 Accent 的独立背景登记到通用背景控件，切换颜色时可原子更换整套素材。 */
    function selCandyAdventureBackgrounds() {
        const selCandyAdventureModeNames = { dark: "星空", light: "晴空" };
        return Object.entries(selCandyAdventureAccentDefinitions).flatMap(([selCandyAdventureMode, selCandyAdventureDefinitions]) =>
            selCandyAdventureDefinitions.map(([selCandyAdventureId, selCandyAdventureLabel]) => ({
                id: `candy-adventure-${selCandyAdventureMode}-${selCandyAdventureId}`,
                name: `${selCandyAdventureModeNames[selCandyAdventureMode]} · ${selCandyAdventureLabel}`,
                category: "糖果冒险",
                image: `../../assets/themes/candy-adventure/${selCandyAdventureMode}/accents/${selCandyAdventureId}/background.webp?v=${selCandyAdventureAssetVersion}`
            }))
        );
    }

    window.sel.theme.registry?.register({
        id: "candy-adventure",
        name: "糖果冒险",
        category: "可爱",
        description: "星空糖果、云朵气球与柔软圆角的儿童冒险乐园",
        icon: "ri-magic-line",
        defaults: { mode: "light", accent: "sky-blue", density: "comfortable" },
        backgrounds: [
            { id: "candy-adventure-dark", name: "星空糖果岛", category: "糖果冒险", image: `../../assets/themes/candy-adventure/dark/base/background.webp?v=${selCandyAdventureAssetVersion}` },
            { id: "candy-adventure-light", name: "糖果云朵城", category: "糖果冒险", image: `../../assets/themes/candy-adventure/light/base/background.webp?v=${selCandyAdventureAssetVersion}` },
            ...selCandyAdventureBackgrounds()
        ],
        modes: [
            {
                id: "dark",
                label: "星空模式",
                themeLabel: "星空糖果岛",
                description: "深蓝夜空 · 明亮易读",
                icon: "ri-moon-stars-line",
                preview: { surface: "#101D4E", card: "#1B2F68", main: "#FFF9EE", muted: "#C4D4F4", accent: "#A784FF" },
                base: { color: "#6BA8FF", ...selCandyAdventureModeSettings.dark },
                accents: selCandyAdventureAccents("dark")
            },
            {
                id: "light",
                label: "晴空模式",
                themeLabel: "糖果云朵城",
                description: "明亮晴空 · 深色文字",
                icon: "ri-sun-line",
                preview: { surface: "#EAF8FF", card: "#FFF7EE", main: "#25324A", muted: "#66758C", accent: "#FF8A70" },
                base: { color: "#3478C9", ...selCandyAdventureModeSettings.light },
                accents: selCandyAdventureAccents("light")
            }
        ]
    });
})();
