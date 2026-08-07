/*
 * selPageBackground.js：通用网页背景图层基础控件。
 * 负责主题清单、背景图层、显示参数和当前页面状态，不创建个性化设置界面。
 * 责任边界：只改变网页背景 CSS 变量；设置入口由 selPersonalization 组合，业务面板状态不进入本模块。
 * 模块级 JavaScript 标识统一使用 selPageBackground 前缀，公开控制器为 window.selPageBackground。
 */
(function selPageBackgroundInitialize() {
    "use strict";

    // 主题包可携带自己的背景清单；背景控件只消费稳定字段，不识别具体主题名称。
    const selPageBackgroundPackThemes = (window.selThemeRegistry?.list?.() || [])
        .flatMap((selPageBackgroundThemePack) => Array.isArray(selPageBackgroundThemePack.backgrounds) ? selPageBackgroundThemePack.backgrounds : [])
        .filter((selPageBackgroundTheme) => /^[a-z][a-z0-9-]*$/.test(selPageBackgroundTheme?.id || "") && typeof selPageBackgroundTheme.image === "string")
        .map((selPageBackgroundTheme) => Object.freeze({ ...selPageBackgroundTheme }));
    // 默认清单只保留通用纯色和用户可独立选择的公共背景；主题配套背景由各自 manifest 登记。
    const selPageBackgroundDefaultThemes = Object.freeze([
        // 纯色 ID 没有图片；背景层透明后直接显示当前主题的 --sel-theme-page-background。
        Object.freeze({ id: "solid-dark", name: "深色纯色", category: "纯色", image: "" }),
        Object.freeze({ id: "solid-light", name: "浅色纯色", category: "纯色", image: "" }),
        Object.freeze({ id: "technology", name: "赛博城市", category: "科技", image: "../../assets/backgrounds/technology-cyber-city.webp" }),
        Object.freeze({ id: "space", name: "紫色星云", category: "宇宙", image: "../../assets/backgrounds/space-purple-nebula.webp" }),
        Object.freeze({ id: "fantasy", name: "水晶森林", category: "奇幻", image: "../../assets/backgrounds/fantasy-emerald-crystal-forest.webp" }),
        Object.freeze({ id: "landscape", name: "金色山湖", category: "风景", image: "../../assets/backgrounds/landscape-golden-mountain-lake.webp" }),
        Object.freeze({ id: "oriental", name: "青绿山水", category: "国风", image: "../../assets/backgrounds/oriental-jade-landscape.webp" }),
        Object.freeze({ id: "minimal", name: "珊瑚流光", category: "简约", image: "../../assets/backgrounds/minimal-coral-lavender-flow.webp" }),
        Object.freeze({ id: "cute", name: "糖果云朵", category: "可爱", image: "../../assets/backgrounds/cute-candy-cloud-world.webp" }),
        Object.freeze({ id: "ocean", name: "珊瑚海城", category: "海洋", image: "../../assets/backgrounds/ocean-turquoise-coral-city.webp" }),
        // 主题包背景在注册表加载完成后自动合并，新增主题不再修改本组件。
        ...selPageBackgroundPackThemes
    ]);
    // 每个背景宿主只创建一个控制器，避免重复挂载背景图层。
    const selPageBackgroundControllers = new WeakMap();

    /**
     * 把外部参数限制到当前背景允许范围。
     * @param {unknown} selPageBackgroundValue - range 或调用方传入的原始值，例如 "58"。
     * @param {number} selPageBackgroundMinimum - 参数业务下限。
     * @param {number} selPageBackgroundMaximum - 参数业务上限。
     * @param {number} selPageBackgroundFallback - 无效输入采用的默认值。
     * @returns {number} 可安全写入背景状态的有限数字，例如 58。
     */
    function selPageBackgroundClamp(selPageBackgroundValue, selPageBackgroundMinimum, selPageBackgroundMaximum, selPageBackgroundFallback) {
        // 数字转换统一兼容 range 字符串和公开 API 数字。
        const selPageBackgroundNumber = Number(selPageBackgroundValue);
        // 非有限输入不得进入 CSS 变量，直接使用稳定默认值。
        if (!Number.isFinite(selPageBackgroundNumber)) {
            return selPageBackgroundFallback;
        }
        // 有效数字被夹在背景控件的业务范围内。
        return Math.min(selPageBackgroundMaximum, Math.max(selPageBackgroundMinimum, selPageBackgroundNumber));
    }

    /**
     * 显式挂载背景图层并返回无界面的状态控制器。
     * @param {Element} selPageBackgroundHost - HTML 提供的背景挂载点，例如 data-sel-page-background-host 节点。
     * @param {object} selPageBackgroundOptions - 主题清单与刷新默认参数。
     * @returns {object|null} 成功时返回只操作当前页面背景的控制器。
     */
    function selPageBackgroundMount(selPageBackgroundHost, selPageBackgroundOptions = {}) {
        // 非元素宿主无法承载背景图片和遮罩图层。
        if (!(selPageBackgroundHost instanceof Element)) {
            return null;
        }
        // 同一宿主重复挂载时复用已经存在的背景控制器。
        if (selPageBackgroundControllers.has(selPageBackgroundHost)) {
            return selPageBackgroundControllers.get(selPageBackgroundHost);
        }
        // 应用可以显式覆盖主题；缺失时继续使用 SEL 标准清单。
        const selPageBackgroundThemes = Object.freeze(
            (Array.isArray(selPageBackgroundOptions.themes) && selPageBackgroundOptions.themes.length > 0
                ? selPageBackgroundOptions.themes
                : selPageBackgroundDefaultThemes
            ).map((selPageBackgroundTheme) => Object.freeze({ ...selPageBackgroundTheme }))
        );
        // 默认状态只来自代码配置，不读取 localStorage，保证刷新页面恢复默认。
        const selPageBackgroundDefaults = Object.freeze({
            theme: selPageBackgroundThemes.some((selPageBackgroundTheme) => selPageBackgroundTheme.id === selPageBackgroundOptions.defaults?.theme)
                ? selPageBackgroundOptions.defaults.theme
                : selPageBackgroundThemes[0].id,
            overlay: selPageBackgroundClamp(selPageBackgroundOptions.defaults?.overlay, 0, 85, 58),
            brightness: selPageBackgroundClamp(selPageBackgroundOptions.defaults?.brightness, 45, 120, 82),
            blur: selPageBackgroundClamp(selPageBackgroundOptions.defaults?.blur, 0, 12, 0)
        });
        // 页面根节点统一承载背景 CSS 变量，业务组件不依赖背景 DOM。
        const selPageBackgroundDocumentRoot = document.documentElement;
        // 背景宿主只生成不可交互的图片层和遮罩层，个性化界面由独立模块负责。
        selPageBackgroundHost.innerHTML = `
            <div class="selpage-background-layer" data-sel-page-background aria-hidden="true">
                <div class="selpage-background-image"></div>
                <div class="selpage-background-overlay"></div>
            </div>
        `;
        // 当前状态从刷新默认值开始，整个生命周期只保存在内存中。
        let selPageBackgroundState = { ...selPageBackgroundDefaults };

        /**
         * 把当前背景状态同步到页面级 CSS 变量并广播标准事件。
         * @returns {void} 只改变当前页面视觉，不写入浏览器缓存。
         */
        function selPageBackgroundApply() {
            // 当前主题必须来自显式清单，异常标识回退第一项。
            const selPageBackgroundTheme = selPageBackgroundThemes.find((selPageBackgroundItem) => selPageBackgroundItem.id === selPageBackgroundState.theme) || selPageBackgroundThemes[0];
            // 图片背景写入真实路径；已登记纯色 ID 使用 none，直接显示主题页面底色。
            selPageBackgroundDocumentRoot.style.setProperty("--selpage-background-image", selPageBackgroundTheme.image ? `url("${selPageBackgroundTheme.image}")` : "none");
            // 遮罩、亮度与模糊继续使用原背景模块的独立变量。
            selPageBackgroundDocumentRoot.style.setProperty("--selpage-background-overlay", String(selPageBackgroundState.overlay / 100));
            selPageBackgroundDocumentRoot.style.setProperty("--selpage-background-brightness", String(selPageBackgroundState.brightness / 100));
            selPageBackgroundDocumentRoot.style.setProperty("--selpage-background-blur", `${selPageBackgroundState.blur}px`);
            // 根标识供视觉验收和未来皮肤规则识别当前主题。
            selPageBackgroundDocumentRoot.dataset.selPageBackgroundTheme = selPageBackgroundTheme.id;
            // 页面事件让个性化界面和其他只读观察者刷新显示状态。
            document.dispatchEvent(new CustomEvent("selPageBackground:change", {
                detail: Object.freeze({ ...selPageBackgroundState })
            }));
        }

        // 公开控制器只操作背景状态，不创建或了解面板设置结构。
        const selPageBackgroundController = Object.freeze({
            // themes 供个性化界面绘制背景主题缩略图。
            themes: selPageBackgroundThemes,
            // defaults 供“恢复默认”动作读取稳定刷新值。
            defaults: selPageBackgroundDefaults,
            // getState 返回不可变副本，调用方不能越过 API 修改内部状态。
            getState: () => Object.freeze({ ...selPageBackgroundState }),
            setTheme(selPageBackgroundThemeId) {
                // 未注册主题不会改变现有背景。
                if (!selPageBackgroundThemes.some((selPageBackgroundTheme) => selPageBackgroundTheme.id === selPageBackgroundThemeId)) {
                    return false;
                }
                // 合法主题只更新主题字段，保留当前显示参数。
                selPageBackgroundState = { ...selPageBackgroundState, theme: selPageBackgroundThemeId };
                // 当前页面立即应用新背景。
                selPageBackgroundApply();
                // true 表示主题切换成功。
                return true;
            },
            setDisplay(selPageBackgroundDisplay = {}) {
                // 三个显示参数分别使用既有业务范围归一化。
                selPageBackgroundState = {
                    ...selPageBackgroundState,
                    overlay: selPageBackgroundClamp(selPageBackgroundDisplay.overlay, 0, 85, selPageBackgroundState.overlay),
                    brightness: selPageBackgroundClamp(selPageBackgroundDisplay.brightness, 45, 120, selPageBackgroundState.brightness),
                    blur: selPageBackgroundClamp(selPageBackgroundDisplay.blur, 0, 12, selPageBackgroundState.blur)
                };
                // 调整结果只在当前页面即时生效。
                selPageBackgroundApply();
                // 返回当前稳定状态供组合界面同步输出。
                return Object.freeze({ ...selPageBackgroundState });
            },
            reset() {
                // 恢复代码默认值，不读取或删除任何本地缓存。
                selPageBackgroundState = { ...selPageBackgroundDefaults };
                // 默认背景立即写回页面。
                selPageBackgroundApply();
                // 返回默认状态便于个性化界面同步。
                return Object.freeze({ ...selPageBackgroundState });
            }
        });
        // 保存控制器后立即应用刷新默认状态。
        selPageBackgroundControllers.set(selPageBackgroundHost, selPageBackgroundController);
        selPageBackgroundApply();
        // 返回控制器供个性化组合模块使用。
        return selPageBackgroundController;
    }

    // 基础背景模块只注册能力，不主动扫描页面或创建设置入口。
    window.selPageBackground = Object.freeze({
        // 默认主题供应用或组合控件直接复用。
        themes: selPageBackgroundDefaultThemes,
        // mount 是创建背景图层的唯一入口。
        mount: selPageBackgroundMount,
        // get 必须接收挂载点，避免猜测页面唯一实例。
        get: (selPageBackgroundHost) => selPageBackgroundControllers.get(selPageBackgroundHost) || null
    });
})();
