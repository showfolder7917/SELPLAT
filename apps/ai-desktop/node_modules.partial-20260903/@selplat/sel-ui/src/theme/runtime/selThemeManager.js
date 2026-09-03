/*
 * selThemeManager.js：SEL 主题运行管理器。
 * 负责切换 Theme、Mode、Accent 与 Density，并把当前主题素材映射为页面统一令牌。
 * 责任边界：不创建个性化界面，不读取业务数据；公开管理器为 window.sel.theme.manager。
 */
(function selThemeManagerInitialize() {
    "use strict";

    const selFreeze = window.sel.core.freeze;

    const selThemeManagerRoot = document.documentElement;
    const selThemeManagerRegistry = window.sel.theme.registry;
    if (!selThemeManagerRegistry?.list().length) {
        throw new Error("SEL theme registry has no registered theme pack.");
    }

    /** 把六位颜色转换为统一 RGB 通道令牌。 */
    function selThemeManagerColorToRgb(selThemeManagerColor) {
        if (typeof selThemeManagerColor !== "string" || !/^#[0-9a-f]{6}$/i.test(selThemeManagerColor)) {
            return null;
        }
        return [1, 3, 5].map((selThemeManagerIndex) => Number.parseInt(selThemeManagerColor.slice(selThemeManagerIndex, selThemeManagerIndex + 2), 16)).join(" ");
    }

    /** 根据主题和模式返回稳定模式定义。 */
    function selThemeManagerResolveMode(selThemeManagerTheme, selThemeManagerModeId) {
        return selThemeManagerTheme.modes.find((selThemeManagerMode) => selThemeManagerMode.id === selThemeManagerModeId)
            || selThemeManagerTheme.modes.find((selThemeManagerMode) => selThemeManagerMode.id === selThemeManagerTheme.defaults.mode)
            || selThemeManagerTheme.modes[0];
    }

    /** 按需装载未来主题登记的样式入口，当前水晶主题仍由页面静态预载以避免首屏闪烁。 */
    function selThemeManagerEnsureStyles(selThemeManagerTheme) {
        (selThemeManagerTheme.styles || []).forEach((selThemeManagerStyle) => {
            if (document.querySelector(`link[data-sel-theme-style="${selThemeManagerTheme.id}"][href="${selThemeManagerStyle}"]`)) {
                return;
            }
            const selThemeManagerLink = document.createElement("link");
            selThemeManagerLink.rel = "stylesheet";
            selThemeManagerLink.href = selThemeManagerStyle;
            selThemeManagerLink.dataset.selThemeStyle = selThemeManagerTheme.id;
            document.head.appendChild(selThemeManagerLink);
        });
    }

    const selThemeManagerInitialTheme = selThemeManagerRegistry.get(selThemeManagerRoot.dataset.selTheme)
        || selThemeManagerRegistry.list()[0];
    const selThemeManagerInitialMode = selThemeManagerResolveMode(selThemeManagerInitialTheme, selThemeManagerRoot.dataset.selMode);
    let selThemeManagerState = {
        theme: selThemeManagerInitialTheme.id,
        mode: selThemeManagerInitialMode.id,
        accent: selThemeManagerRoot.dataset.selAccent || selThemeManagerInitialTheme.defaults?.accent || null,
        density: selThemeManagerRoot.dataset.selDensity || selThemeManagerInitialTheme.defaults?.density || "comfortable"
    };

    /** 将当前主题状态原子写入根属性、颜色和素材令牌。 */
    function selThemeManagerApply(selThemeManagerSource = "api") {
        const selThemeManagerTheme = selThemeManagerRegistry.get(selThemeManagerState.theme) || selThemeManagerRegistry.list()[0];
        const selThemeManagerMode = selThemeManagerResolveMode(selThemeManagerTheme, selThemeManagerState.mode);
        const selThemeManagerAccent = selThemeManagerMode.accents.find((selThemeManagerItem) => selThemeManagerItem.id === selThemeManagerState.accent) || null;
        selThemeManagerState = { ...selThemeManagerState, theme: selThemeManagerTheme.id, mode: selThemeManagerMode.id, accent: selThemeManagerAccent?.id || null };
        selThemeManagerEnsureStyles(selThemeManagerTheme);
        selThemeManagerRoot.dataset.selTheme = selThemeManagerTheme.id;
        selThemeManagerRoot.dataset.selMode = selThemeManagerMode.id;
        selThemeManagerRoot.dataset.selAccent = selThemeManagerAccent?.id || "base";
        selThemeManagerRoot.dataset.selDensity = selThemeManagerState.density;
        const selThemeManagerMaterial = selThemeManagerAccent || selThemeManagerMode.base;
        const selThemeManagerRgb = selThemeManagerColorToRgb(selThemeManagerMaterial.color);
        if (selThemeManagerRgb) {
            selThemeManagerRoot.style.setProperty("--sel-theme-color-rgb", selThemeManagerRgb);
        } else {
            selThemeManagerRoot.style.removeProperty("--sel-theme-color-rgb");
        }
        if (selThemeManagerMaterial.frameImage) {
            selThemeManagerRoot.style.setProperty("--sel-theme-frame-image", `url("${selThemeManagerMaterial.frameImage}")`);
        } else {
            selThemeManagerRoot.style.removeProperty("--sel-theme-frame-image");
        }
        document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", selThemeManagerMode.id);
        document.dispatchEvent(new CustomEvent("selTheme:change", {
            detail: selFreeze({ ...selThemeManagerState, source: selThemeManagerSource })
        }));
        return true;
    }

    window.sel.register("theme.manager", {
        themes: selThemeManagerRegistry.list,
        getTheme: () => selThemeManagerRegistry.get(selThemeManagerState.theme),
        getMode: () => selThemeManagerResolveMode(selThemeManagerRegistry.get(selThemeManagerState.theme), selThemeManagerState.mode),
        getAccent: () => {
            const selThemeManagerMode = selThemeManagerResolveMode(selThemeManagerRegistry.get(selThemeManagerState.theme), selThemeManagerState.mode);
            return selThemeManagerMode.accents.find((selThemeManagerAccent) => selThemeManagerAccent.id === selThemeManagerState.accent) || null;
        },
        getState: () => selFreeze({ ...selThemeManagerState }),
        setTheme(selThemeManagerThemeId) {
            const selThemeManagerTheme = selThemeManagerRegistry.get(selThemeManagerThemeId);
            if (!selThemeManagerTheme) return false;
            const selThemeManagerMode = selThemeManagerResolveMode(selThemeManagerTheme, selThemeManagerState.mode);
            selThemeManagerState = {
                ...selThemeManagerState,
                theme: selThemeManagerTheme.id,
                mode: selThemeManagerMode.id,
                accent: selThemeManagerMode.accents.some((selThemeManagerAccent) => selThemeManagerAccent.id === selThemeManagerState.accent)
                    ? selThemeManagerState.accent
                    : selThemeManagerTheme.defaults?.accent || null,
                density: selThemeManagerTheme.defaults?.density || selThemeManagerState.density
            };
            return selThemeManagerApply("theme");
        },
        setMode(selThemeManagerModeId) {
            const selThemeManagerTheme = selThemeManagerRegistry.get(selThemeManagerState.theme);
            if (!selThemeManagerTheme?.modes.some((selThemeManagerMode) => selThemeManagerMode.id === selThemeManagerModeId)) return false;
            selThemeManagerState = { ...selThemeManagerState, mode: selThemeManagerModeId };
            return selThemeManagerApply("mode");
        },
        setAccent(selThemeManagerAccentId) {
            const selThemeManagerMode = selThemeManagerResolveMode(selThemeManagerRegistry.get(selThemeManagerState.theme), selThemeManagerState.mode);
            if (selThemeManagerAccentId && !selThemeManagerMode.accents.some((selThemeManagerAccent) => selThemeManagerAccent.id === selThemeManagerAccentId)) return false;
            selThemeManagerState = { ...selThemeManagerState, accent: selThemeManagerAccentId || null };
            return selThemeManagerApply("accent");
        },
        setDensity(selThemeManagerDensity) {
            if (!/^[a-z][a-z0-9-]*$/.test(selThemeManagerDensity || "")) return false;
            selThemeManagerState = { ...selThemeManagerState, density: selThemeManagerDensity };
            return selThemeManagerApply("density");
        },
        apply: () => selThemeManagerApply("initialize")
    });
    window.sel.theme.manager.apply();
})();
