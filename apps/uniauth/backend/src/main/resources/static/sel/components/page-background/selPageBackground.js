/*
 * selPageBackground.js：通用网页背景主题基础控件。
 * 负责创建背景图层、主题选择器、显示参数、状态记忆和公开控制器。
 * 责任边界：只接收标准主题和显示文案，不识别 Uniauth、表格实例或业务实体。
 * 模块级 JavaScript 标识统一使用 selPageBackground 前缀，公开控制器为 window.selPageBackground。
 */
(function selPageBackgroundInitialize() {
    "use strict";

    // 默认主题使用 SEL 基础素材目录；相对地址按配套 CSS 的位置解析。
    const selPageBackgroundDefaultThemes = Object.freeze([
        Object.freeze({ id: "technology", name: "赛博城市", category: "科技", image: "../../assets/backgrounds/technology-cyber-city.webp" }),
        Object.freeze({ id: "space", name: "紫色星云", category: "宇宙", image: "../../assets/backgrounds/space-purple-nebula.webp" }),
        Object.freeze({ id: "fantasy", name: "水晶森林", category: "奇幻", image: "../../assets/backgrounds/fantasy-emerald-crystal-forest.webp" }),
        Object.freeze({ id: "landscape", name: "金色山湖", category: "风景", image: "../../assets/backgrounds/landscape-golden-mountain-lake.webp" }),
        Object.freeze({ id: "oriental", name: "青绿山水", category: "国风", image: "../../assets/backgrounds/oriental-jade-landscape.webp" }),
        Object.freeze({ id: "minimal", name: "珊瑚流光", category: "简约", image: "../../assets/backgrounds/minimal-coral-lavender-flow.webp" }),
        Object.freeze({ id: "cute", name: "糖果云朵", category: "可爱", image: "../../assets/backgrounds/cute-candy-cloud-world.webp" }),
        Object.freeze({ id: "ocean", name: "珊瑚海城", category: "海洋", image: "../../assets/backgrounds/ocean-turquoise-coral-city.webp" })
    ]);
    // 默认显示文案可以由应用按语言覆盖，但基础控件拥有稳定回退。
    const selPageBackgroundDefaultLabels = Object.freeze({
        controlAriaLabel: "网页背景设置",
        triggerAriaLabel: "选择网页背景",
        heading: "选择网页背景",
        themeCount: "8 种独立主题",
        themeGridAriaLabel: "背景主题",
        adjustmentsAriaLabel: "背景显示参数",
        overlay: "遮罩",
        brightness: "亮度",
        blur: "模糊"
    });
    // 每个挂载点保存独立控制器，重复挂载时返回同一实例。
    const selPageBackgroundControllers = new WeakMap();

    /**
     * 把外部数值限制到控件允许范围。
     * @param {unknown} selPageBackgroundValue - 本地存储或 range 控件的原始值，例如 "58"。
     * @param {number} selPageBackgroundMinimum - 当前参数允许的最小值。
     * @param {number} selPageBackgroundMaximum - 当前参数允许的最大值。
     * @param {number} selPageBackgroundFallback - 原始值无效时采用的默认值。
     * @returns {number} 可直接写入 CSS 变量的有限数值，例如 58。
     */
    function selPageBackgroundClamp(selPageBackgroundValue, selPageBackgroundMinimum, selPageBackgroundMaximum, selPageBackgroundFallback) {
        // Number 转换统一处理 range 字符串和 JSON 数字。
        const selPageBackgroundNumber = Number(selPageBackgroundValue);
        // 非有限数值会破坏 CSS，因此必须回退默认值。
        if (!Number.isFinite(selPageBackgroundNumber)) {
            return selPageBackgroundFallback;
        }
        // 合法数值被夹在业务允许范围内。
        return Math.min(selPageBackgroundMaximum, Math.max(selPageBackgroundMinimum, selPageBackgroundNumber));
    }

    /**
     * 显式挂载一个网页背景控件。
     * @param {Element} selPageBackgroundHost - HTML 提供的空挂载点。
     * @param {object} selPageBackgroundOptions - 可选主题、文案、默认参数和存储键。
     * @returns {object|null} 成功时返回当前背景控制器。
     */
    function selPageBackgroundMount(selPageBackgroundHost, selPageBackgroundOptions = {}) {
        // 非元素宿主不能承载背景图层与选择器。
        if (!(selPageBackgroundHost instanceof Element)) {
            return null;
        }
        // 同一宿主重复挂载时复用原控制器。
        if (selPageBackgroundControllers.has(selPageBackgroundHost)) {
            return selPageBackgroundControllers.get(selPageBackgroundHost);
        }
        // 应用可以传入标准主题数组；缺失时使用 SEL 默认主题。
        const selPageBackgroundThemes = Object.freeze(
            (Array.isArray(selPageBackgroundOptions.themes) && selPageBackgroundOptions.themes.length > 0
                ? selPageBackgroundOptions.themes
                : selPageBackgroundDefaultThemes
            ).map((selPageBackgroundTheme) => Object.freeze({ ...selPageBackgroundTheme }))
        );
        // 应用文案只覆盖已知字段，避免内部结构依赖任意键。
        const selPageBackgroundLabels = Object.freeze({
            ...selPageBackgroundDefaultLabels,
            ...(selPageBackgroundOptions.labels || {}),
            themeCount: selPageBackgroundOptions.labels?.themeCount || `${selPageBackgroundThemes.length} 种独立主题`
        });
        // 默认参数在图片未加载或本地设置损坏时提供稳定结果。
        const selPageBackgroundDefaults = Object.freeze({
            theme: selPageBackgroundOptions.defaults?.theme || selPageBackgroundThemes[0].id,
            overlay: selPageBackgroundClamp(selPageBackgroundOptions.defaults?.overlay, 0, 85, 58),
            brightness: selPageBackgroundClamp(selPageBackgroundOptions.defaults?.brightness, 45, 120, 82),
            blur: selPageBackgroundClamp(selPageBackgroundOptions.defaults?.blur, 0, 12, 0)
        });
        // 存储键由应用可选命名空间区分，默认保持跨页面通用背景偏好。
        const selPageBackgroundStorageKey = String(selPageBackgroundOptions.storageKey || "selPageBackground.preferences.v1");
        // 页面根节点承载 CSS 变量，使背景层与业务控件 DOM 解耦。
        const selPageBackgroundDocumentRoot = document.documentElement;
        // 固定结构只包含通用背景区域和原生交互元素。
        selPageBackgroundHost.innerHTML = `
            <div class="selpage-background-layer" data-sel-page-background aria-hidden="true">
                <div class="selpage-background-image"></div>
                <div class="selpage-background-overlay"></div>
            </div>
            <aside class="selpage-background-control" data-sel-page-background-control>
                <button class="selpage-background-trigger" type="button" data-sel-page-background-action="toggle" aria-expanded="false">
                    <i class="ri-landscape-line" aria-hidden="true"></i>
                </button>
                <section class="selpage-background-panel" data-sel-page-background-panel hidden>
                    <header class="selpage-background-heading">
                        <strong data-sel-page-background-label="heading"></strong>
                        <span data-sel-page-background-label="theme-count"></span>
                    </header>
                    <div class="selpage-background-grid" data-sel-page-background-grid></div>
                    <div class="selpage-background-adjustments" data-sel-page-background-adjustments>
                        <label class="selpage-background-range">
                            <span data-sel-page-background-label="overlay"></span>
                            <input type="range" min="0" max="85" step="1" data-sel-page-background-range="overlay">
                            <output data-sel-page-background-output="overlay">58%</output>
                        </label>
                        <label class="selpage-background-range">
                            <span data-sel-page-background-label="brightness"></span>
                            <input type="range" min="45" max="120" step="1" data-sel-page-background-range="brightness">
                            <output data-sel-page-background-output="brightness">82%</output>
                        </label>
                        <label class="selpage-background-range">
                            <span data-sel-page-background-label="blur"></span>
                            <input type="range" min="0" max="12" step="1" data-sel-page-background-range="blur">
                            <output data-sel-page-background-output="blur">0px</output>
                        </label>
                    </div>
                </section>
            </aside>
        `;
        // 当前宿主内的固定节点供后续交互和状态同步使用。
        const selPageBackgroundControl = selPageBackgroundHost.querySelector("[data-sel-page-background-control]");
        const selPageBackgroundTrigger = selPageBackgroundHost.querySelector("[data-sel-page-background-action='toggle']");
        const selPageBackgroundPanel = selPageBackgroundHost.querySelector("[data-sel-page-background-panel]");
        const selPageBackgroundGrid = selPageBackgroundHost.querySelector("[data-sel-page-background-grid]");
        const selPageBackgroundAdjustments = selPageBackgroundHost.querySelector("[data-sel-page-background-adjustments]");
        // 固定结构缺失时阻止创建半成品控制器。
        if (!selPageBackgroundControl || !selPageBackgroundTrigger || !selPageBackgroundPanel || !selPageBackgroundGrid || !selPageBackgroundAdjustments) {
            return null;
        }
        // 可访问名称和可见标题通过安全文本写入。
        selPageBackgroundControl.setAttribute("aria-label", selPageBackgroundLabels.controlAriaLabel);
        selPageBackgroundTrigger.setAttribute("aria-label", selPageBackgroundLabels.triggerAriaLabel);
        selPageBackgroundGrid.setAttribute("aria-label", selPageBackgroundLabels.themeGridAriaLabel);
        selPageBackgroundAdjustments.setAttribute("aria-label", selPageBackgroundLabels.adjustmentsAriaLabel);
        selPageBackgroundHost.querySelector("[data-sel-page-background-label='heading']").textContent = selPageBackgroundLabels.heading;
        selPageBackgroundHost.querySelector("[data-sel-page-background-label='theme-count']").textContent = selPageBackgroundLabels.themeCount;
        selPageBackgroundHost.querySelector("[data-sel-page-background-label='overlay']").textContent = selPageBackgroundLabels.overlay;
        selPageBackgroundHost.querySelector("[data-sel-page-background-label='brightness']").textContent = selPageBackgroundLabels.brightness;
        selPageBackgroundHost.querySelector("[data-sel-page-background-label='blur']").textContent = selPageBackgroundLabels.blur;

        // 每个主题创建一个原生按钮，缩略图直接复用正式背景素材。
        selPageBackgroundThemes.forEach((selPageBackgroundTheme) => {
            // 原生按钮提供键盘和 aria-pressed 语义。
            const selPageBackgroundButton = document.createElement("button");
            selPageBackgroundButton.className = "selpage-background-option";
            selPageBackgroundButton.type = "button";
            selPageBackgroundButton.dataset.selPageBackgroundTheme = selPageBackgroundTheme.id;
            selPageBackgroundButton.style.setProperty("--selpage-theme-thumbnail", `url("${selPageBackgroundTheme.image}")`);
            selPageBackgroundButton.setAttribute("aria-pressed", "false");
            // 文案容器保持标题和分类层级。
            const selPageBackgroundCopy = document.createElement("span");
            selPageBackgroundCopy.className = "selpage-background-option-copy";
            const selPageBackgroundName = document.createElement("strong");
            selPageBackgroundName.textContent = selPageBackgroundTheme.name;
            const selPageBackgroundCategory = document.createElement("span");
            selPageBackgroundCategory.textContent = selPageBackgroundTheme.category;
            selPageBackgroundCopy.append(selPageBackgroundName, selPageBackgroundCategory);
            selPageBackgroundButton.appendChild(selPageBackgroundCopy);
            selPageBackgroundGrid.appendChild(selPageBackgroundButton);
        });

        // 从默认值开始，再尝试合并浏览器中的用户偏好。
        let selPageBackgroundState = selPageBackgroundReadState();

        // 读取并校验浏览器偏好；异常数据直接回退默认值。
        function selPageBackgroundReadState() {
            try {
                // 用户上次选择用于跨刷新恢复同一背景效果。
                const selPageBackgroundSaved = JSON.parse(localStorage.getItem(selPageBackgroundStorageKey) || "{}");
                // 只允许已注册主题进入运行状态。
                const selPageBackgroundThemeExists = selPageBackgroundThemes.some((selPageBackgroundTheme) => selPageBackgroundTheme.id === selPageBackgroundSaved.theme);
                // 返回经过范围归一化的稳定状态。
                return {
                    theme: selPageBackgroundThemeExists ? selPageBackgroundSaved.theme : selPageBackgroundDefaults.theme,
                    overlay: selPageBackgroundClamp(selPageBackgroundSaved.overlay, 0, 85, selPageBackgroundDefaults.overlay),
                    brightness: selPageBackgroundClamp(selPageBackgroundSaved.brightness, 45, 120, selPageBackgroundDefaults.brightness),
                    blur: selPageBackgroundClamp(selPageBackgroundSaved.blur, 0, 12, selPageBackgroundDefaults.blur)
                };
            } catch (selPageBackgroundError) {
                // 浏览器禁用存储或数据损坏时仍使用默认主题。
                return { ...selPageBackgroundDefaults };
            }
        }

        // 同步选择按钮和三个参数输出。
        function selPageBackgroundSyncControl() {
            // 每个按钮只根据当前主题维护 pressed 状态。
            selPageBackgroundGrid.querySelectorAll("[data-sel-page-background-theme]").forEach((selPageBackgroundButton) => {
                selPageBackgroundButton.setAttribute("aria-pressed", String(selPageBackgroundButton.dataset.selPageBackgroundTheme === selPageBackgroundState.theme));
            });
            // 三种参数共享稳定映射。
            ["overlay", "brightness", "blur"].forEach((selPageBackgroundParameter) => {
                const selPageBackgroundRange = selPageBackgroundControl.querySelector(`[data-sel-page-background-range="${selPageBackgroundParameter}"]`);
                const selPageBackgroundOutput = selPageBackgroundControl.querySelector(`[data-sel-page-background-output="${selPageBackgroundParameter}"]`);
                if (selPageBackgroundRange) {
                    selPageBackgroundRange.value = String(selPageBackgroundState[selPageBackgroundParameter]);
                }
                if (selPageBackgroundOutput) {
                    selPageBackgroundOutput.value = selPageBackgroundParameter === "blur" ? `${selPageBackgroundState.blur}px` : `${selPageBackgroundState[selPageBackgroundParameter]}%`;
                }
            });
        }

        // 将当前状态写入 CSS 变量、选择器和可选本地存储。
        function selPageBackgroundApply(selPageBackgroundPersist) {
            // 当前主题必须来自固定清单。
            const selPageBackgroundTheme = selPageBackgroundThemes.find((selPageBackgroundItem) => selPageBackgroundItem.id === selPageBackgroundState.theme) || selPageBackgroundThemes[0];
            // 图片、遮罩、亮度和模糊分别写入独立变量。
            selPageBackgroundDocumentRoot.style.setProperty("--selpage-background-image", `url("${selPageBackgroundTheme.image}")`);
            selPageBackgroundDocumentRoot.style.setProperty("--selpage-background-overlay", String(selPageBackgroundState.overlay / 100));
            selPageBackgroundDocumentRoot.style.setProperty("--selpage-background-brightness", String(selPageBackgroundState.brightness / 100));
            selPageBackgroundDocumentRoot.style.setProperty("--selpage-background-blur", `${selPageBackgroundState.blur}px`);
            // HTML 标识支持自动化验收当前主题。
            selPageBackgroundDocumentRoot.dataset.selPageBackgroundTheme = selPageBackgroundTheme.id;
            // 选择器同步当前状态。
            selPageBackgroundSyncControl();
            // 只有用户操作才持久化。
            if (selPageBackgroundPersist) {
                try {
                    localStorage.setItem(selPageBackgroundStorageKey, JSON.stringify(selPageBackgroundState));
                } catch (selPageBackgroundError) {
                    // 存储失败不影响当前已经应用的视觉结果。
                }
            }
            // 页面级事件通知宿主背景变化。
            document.dispatchEvent(new CustomEvent("selPageBackground:change", {
                detail: Object.freeze({ ...selPageBackgroundState })
            }));
        }

        // 入口按钮只切换当前背景面板。
        selPageBackgroundTrigger.addEventListener("click", () => {
            const selPageBackgroundOpen = selPageBackgroundPanel.hidden;
            selPageBackgroundPanel.hidden = !selPageBackgroundOpen;
            selPageBackgroundTrigger.setAttribute("aria-expanded", String(selPageBackgroundOpen));
        });
        // 主题按钮使用事件委托更新稳定主题标识。
        selPageBackgroundGrid.addEventListener("click", (selPageBackgroundEvent) => {
            const selPageBackgroundButton = selPageBackgroundEvent.target.closest("[data-sel-page-background-theme]");
            if (!selPageBackgroundButton) {
                return;
            }
            selPageBackgroundState = { ...selPageBackgroundState, theme: selPageBackgroundButton.dataset.selPageBackgroundTheme };
            selPageBackgroundApply(true);
        });
        // 三个 range 共享同一输入处理流程。
        selPageBackgroundControl.querySelectorAll("[data-sel-page-background-range]").forEach((selPageBackgroundRange) => {
            selPageBackgroundRange.addEventListener("input", () => {
                const selPageBackgroundParameter = selPageBackgroundRange.dataset.selPageBackgroundRange;
                if (!["overlay", "brightness", "blur"].includes(selPageBackgroundParameter)) {
                    return;
                }
                const selPageBackgroundValue = selPageBackgroundClamp(
                    selPageBackgroundRange.value,
                    Number(selPageBackgroundRange.min),
                    Number(selPageBackgroundRange.max),
                    selPageBackgroundDefaults[selPageBackgroundParameter]
                );
                selPageBackgroundState = { ...selPageBackgroundState, [selPageBackgroundParameter]: selPageBackgroundValue };
                selPageBackgroundApply(true);
            });
        });
        // 点击控件之外时关闭背景面板。
        document.addEventListener("pointerdown", (selPageBackgroundEvent) => {
            if (!selPageBackgroundControl.contains(selPageBackgroundEvent.target)) {
                selPageBackgroundPanel.hidden = true;
                selPageBackgroundTrigger.setAttribute("aria-expanded", "false");
            }
        });
        // Escape 提供键盘关闭路径。
        document.addEventListener("keydown", (selPageBackgroundEvent) => {
            if (selPageBackgroundEvent.key === "Escape") {
                selPageBackgroundPanel.hidden = true;
                selPageBackgroundTrigger.setAttribute("aria-expanded", "false");
                selPageBackgroundTrigger.focus();
            }
        });

        // 公开控制器只操作当前挂载实例的状态。
        const selPageBackgroundController = Object.freeze({
            themes: selPageBackgroundThemes,
            getState: () => Object.freeze({ ...selPageBackgroundState }),
            setTheme(selPageBackgroundThemeId) {
                if (!selPageBackgroundThemes.some((selPageBackgroundTheme) => selPageBackgroundTheme.id === selPageBackgroundThemeId)) {
                    return false;
                }
                selPageBackgroundState = { ...selPageBackgroundState, theme: selPageBackgroundThemeId };
                selPageBackgroundApply(true);
                return true;
            },
            reset() {
                selPageBackgroundState = { ...selPageBackgroundDefaults };
                selPageBackgroundApply(true);
            }
        });
        // 保存控制器后立即应用默认或已保存状态。
        selPageBackgroundControllers.set(selPageBackgroundHost, selPageBackgroundController);
        selPageBackgroundApply(false);
        // 返回控制器供应用装配层确认挂载成功。
        return selPageBackgroundController;
    }

    // 基础模块只注册能力，不主动扫描页面或识别应用。
    window.selPageBackground = Object.freeze({
        // 默认主题供应用按需复用或扩展。
        themes: selPageBackgroundDefaultThemes,
        // mount 是创建背景 UI 与控制器的唯一入口。
        mount: selPageBackgroundMount,
        // get 必须指定挂载点，避免猜测页面唯一实例。
        get: (selPageBackgroundHost) => selPageBackgroundControllers.get(selPageBackgroundHost) || null
    });
})();
