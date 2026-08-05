# SEL 主题包接入说明

一个主题包代表一种完整视觉风格，并同时拥有深色、浅色两种模式。每个模式必须分别登记基础材质和颜色组合；同一个 Accent ID 可以在深浅模式下使用不同颜色、边框和背景。

## 新增主题

1. 新建 `packs/<theme-id>/manifest.js`、`theme.css`、`modes/dark.css` 和 `modes/light.css`。
2. manifest 通过 `window.selThemeRegistry.register(...)` 登记主题。
3. `modes` 中同时声明 `dark` 和 `light`；每个模式分别提供 `base` 与 `accents`。
4. 主题自带背景时在 manifest 的 `backgrounds` 数组登记稳定 ID、名称、分类和图片地址，背景控件会自动合并。
5. 在应用 HTML 中于 `selThemeRegistry.js` 之后、`selThemeManager.js` 之前加载新 manifest。
6. 如果主题样式没有由页面静态预载，在 manifest 的 `styles` 数组登记 CSS 地址，主题管理器会在首次切换时装载。

## Manifest 最小结构

```javascript
window.selThemeRegistry.register({
    id: "classic-enterprise",
    name: "经典商务",
    description: "紧凑、直角、低光效的企业桌面风格",
    icon: "ri-building-line",
    defaults: { mode: "dark", accent: "amber", density: "compact" },
    styles: [
        "/sel/theme/packs/classic-enterprise/theme.css",
        "/sel/theme/packs/classic-enterprise/modes/dark.css",
        "/sel/theme/packs/classic-enterprise/modes/light.css"
    ],
    modes: [
        {
            id: "dark",
            label: "深色皮肤",
            themeLabel: "深灰桌面",
            description: "深色界面 · 浅色文字",
            icon: "ri-moon-line",
            preview: { surface: "#242B38", card: "#303848", main: "#F3F5F8", muted: "#ABB4C2", accent: "#D4852C" },
            base: { color: "#6F819C", frameImage: "", backgroundTheme: "void", backgroundDisplay: { overlay: 55, brightness: 82, blur: 0 } },
            accents: [
                { id: "amber", label: "琥珀橙", color: "#D4852C", frameImage: "", backgroundTheme: "void", backgroundDisplay: { overlay: 55, brightness: 82, blur: 0 } }
            ]
        },
        {
            id: "light",
            label: "浅色皮肤",
            themeLabel: "银灰桌面",
            description: "浅色界面 · 深色文字",
            icon: "ri-sun-line",
            preview: { surface: "#EEF1F5", card: "#FFFFFF", main: "#202631", muted: "#667085", accent: "#A85E17" },
            base: { color: "#52647D", frameImage: "", backgroundTheme: "morning-mist", backgroundDisplay: { overlay: 18, brightness: 98, blur: 0 } },
            accents: [
                { id: "amber", label: "琥珀橙", color: "#A85E17", frameImage: "", backgroundTheme: "morning-mist", backgroundDisplay: { overlay: 18, brightness: 98, blur: 0 } }
            ]
        }
    ]
});
```

组件 JavaScript、组件 DOM 和业务数据不得复制到主题包。新主题只提供 manifest、令牌、素材和必要的纯视觉组件覆盖。
