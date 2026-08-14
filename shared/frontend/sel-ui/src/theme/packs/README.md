# SEL 主题包接入说明

一个主题包代表一种完整视觉风格，并同时拥有深色、浅色两种模式。每个模式必须分别登记基础材质和颜色组合；同一个 Accent ID 可以在深浅模式下使用不同颜色、边框和背景。

## 新增主题

1. 新建 `packs/<theme-id>/manifest.js`、`theme.css`、`modes/dark.css` 和 `modes/light.css`。
2. 如有主题独占图片，建立 `../../assets/themes/<theme-id>/`；其目录 ID 必须与主题包 ID 一致。
   - 基础皮肤素材：`<mode>/base/frame.webp` 和 `background.webp`
   - Accent 皮肤素材：`<mode>/accents/<accent-id>/frame.webp` 和 `background.webp`
   - 同一皮肤的边框与背景必须放在同一目录，不按素材类型或文件名前缀平铺。
3. manifest 通过 `window.sel.theme.registry.register(...)` 登记主题，并且是主题独占素材的唯一路径持有者。
4. `modes` 中同时声明 `dark` 和 `light`；每个模式分别提供 `base` 与 `accents`。
5. 主题自带背景时在 manifest 的 `backgrounds` 数组登记，图片必须来自 `assets/themes/<同一 theme-id>/`；禁止自动引用其他主题或公共背景。无图主题可使用已登记的纯色背景 ID。
6. 在应用 HTML 中于 `selThemeRegistry.js` 之后、`selThemeManager.js` 之前加载新 manifest。
7. 如果主题样式没有由页面静态预载，在 manifest 的 `styles` 数组登记 CSS 地址，主题管理器会在首次切换时装载。

## 目录归属

| 内容 | 位置 | 判定标准 |
| --- | --- | --- |
| 主题定义 | `theme/packs/<theme-id>/` | manifest、深浅令牌和纯视觉覆盖 |
| 主题独占素材 | `assets/themes/<theme-id>/` | 只有该主题使用的边框、纹理或背景 |
| 公共背景 | `assets/backgrounds/` | 只由用户在背景面板独立选择，不作为主题自动配套素材 |
| 组件素材 | `assets/components/<component>/` | 属于组件本身，且不随主题切换 |
| 跨组件公用素材 | `assets/shared/` | 至少两个基础控件真实复用 |

## Manifest 最小结构

```javascript
window.sel.theme.registry.register({
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
            base: { color: "#6F819C", frameImage: "", backgroundTheme: "solid-dark", backgroundDisplay: { overlay: 0, brightness: 100, blur: 0 } },
            accents: [
                { id: "amber", label: "琥珀橙", color: "#D4852C", frameImage: "", backgroundTheme: "solid-dark", backgroundDisplay: { overlay: 0, brightness: 100, blur: 0 } }
            ]
        },
        {
            id: "light",
            label: "浅色皮肤",
            themeLabel: "银灰桌面",
            description: "浅色界面 · 深色文字",
            icon: "ri-sun-line",
            preview: { surface: "#EEF1F5", card: "#FFFFFF", main: "#202631", muted: "#667085", accent: "#A85E17" },
            base: { color: "#52647D", frameImage: "", backgroundTheme: "solid-light", backgroundDisplay: { overlay: 0, brightness: 100, blur: 0 } },
            accents: [
                { id: "amber", label: "琥珀橙", color: "#A85E17", frameImage: "", backgroundTheme: "solid-light", backgroundDisplay: { overlay: 0, brightness: 100, blur: 0 } }
            ]
        }
    ]
});
```

组件 JavaScript、组件 DOM 和业务数据不得复制到主题包。新主题只提供 manifest、令牌、素材和必要的纯视觉组件覆盖。

## 已发布主题

- `crystal-tech`（水晶科技）：真实图片窗框、深海玻璃和发光数据栅格；独占素材位于 `assets/themes/crystal-tech/`。
- `glass-admin`（晶透管理）：CSS 玻璃描边、柔和圆角和轻量管理后台；暂无独占位图，深浅模式使用纯色页面背景。
- `candy-adventure`（糖果冒险）：卡通图片边框、独立背景和圆润组件造型；独占素材位于 `assets/themes/candy-adventure/`。

应用只需在注册表与管理器之间加载主题 manifest。默认主题可通过根节点的 `data-sel-theme` 指定；公共个性化组件会自动读取主题库、模式和皮肤，不需要为新主题增加业务按钮。
