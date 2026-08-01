/*
 * selPersonalization.js：SEL 页面个性化设置组合控件。
 * 负责“背景设置 / 面板设置”两级界面、面板视觉令牌、动效、预设和当前页面实时预览。
 * 责任边界：背景值通过 selPageBackground 控制器修改；面板值只写页面级 selpersonal CSS 变量，不识别 Uniauth 业务数据。
 * 模块级 JavaScript 标识统一使用 selPersonalization 前缀，公开控制器为 window.selPersonalization。
 */
(function selPersonalizationInitialize() {
    "use strict";

    // 每个个性化宿主只创建一个控制器，避免重复绑定全局输入事件。
    const selPersonalizationControllers = new WeakMap();
    // 面板默认值全部采用 0 至 100 的用户尺度，刷新页面时从这里重新开始。
    const selPersonalizationPanelDefaults = Object.freeze({
        // null 表示使用当前皮肤提供的主题色，刷新页面不会遗留用户临时选色。
        themeColor: null,
        panelOpacity: 82,
        glassBlur: 58,
        themeTint: 68,
        frameWidth: 50,
        contentInset: 50,
        panelGap: 50,
        glowSpread: 55,
        controlGap: 50,
        windowMotion: 60,
        glowMotion: 46,
        reducedMotion: false,
        preset: "deep-space"
    });
    // 常用色只提供快速选择入口，不代表固定皮肤；任意颜色仍可通过原生颜色控件选择。
    const selPersonalizationThemeColors = Object.freeze([
        Object.freeze({ value: "#4A8BFF", label: "星际蓝" }),
        Object.freeze({ value: "#28D7FF", label: "水晶青" }),
        Object.freeze({ value: "#8067FF", label: "星云紫" }),
        Object.freeze({ value: "#28C7A5", label: "翡翠绿" }),
        Object.freeze({ value: "#F3B348", label: "琥珀金" }),
        Object.freeze({ value: "#EC5D9A", label: "脉冲粉" })
    ]);
    // 水晶九宫格使用同源运行素材；临时着色结果只保存在页面内存和 CSS 变量中。
    const selPersonalizationFrameSource = new URL("../../assets/components/panel/selPanelCyberFrame.webp?v=20260801-3", document.currentScript?.src || document.baseURI).href;
    // 原图加载 Promise 在当前页面复用，避免每次拖动颜色选择器都重新请求素材。
    let selPersonalizationFrameImagePromise = null;
    // 已生成颜色在当前页面内存中复用，刷新后随页面一起释放。
    const selPersonalizationFrameColorCache = new Map();
    // 预设只保存与皮肤无关的强度值；实际颜色始终来自当前皮肤 CSS 令牌。
    const selPersonalizationPresets = Object.freeze([
        Object.freeze({ id: "deep-space", label: "深空", icon: "ri-moon-clear-line", values: Object.freeze({ panelOpacity: 82, glassBlur: 58, themeTint: 68, frameWidth: 50, contentInset: 50, panelGap: 50, glowSpread: 55, controlGap: 50, windowMotion: 60, glowMotion: 46, reducedMotion: false }) }),
        Object.freeze({ id: "transparent", label: "通透", icon: "ri-contrast-drop-2-line", values: Object.freeze({ panelOpacity: 34, glassBlur: 86, themeTint: 42, frameWidth: 46, contentInset: 56, panelGap: 58, glowSpread: 62, controlGap: 54, windowMotion: 64, glowMotion: 62, reducedMotion: false }) }),
        Object.freeze({ id: "eye-care", label: "护眼", icon: "ri-eye-line", values: Object.freeze({ panelOpacity: 91, glassBlur: 36, themeTint: 30, frameWidth: 48, contentInset: 58, panelGap: 58, glowSpread: 24, controlGap: 58, windowMotion: 24, glowMotion: 12, reducedMotion: true }) }),
        Object.freeze({ id: "high-contrast", label: "高对比", icon: "ri-contrast-2-line", values: Object.freeze({ panelOpacity: 100, glassBlur: 12, themeTint: 55, frameWidth: 58, contentInset: 54, panelGap: 54, glowSpread: 38, controlGap: 54, windowMotion: 42, glowMotion: 28, reducedMotion: false }) }),
        Object.freeze({ id: "custom", label: "自定义", icon: "ri-equalizer-2-line", values: null })
    ]);
    // 面板 range 配置集中声明分组、标签和辅助说明，增删项目不需要复制事件分支。
    const selPersonalizationPanelRangeGroups = Object.freeze([
        Object.freeze({
            id: "appearance",
            title: "外观",
            icon: "ri-palette-line",
            items: Object.freeze([
                Object.freeze({ key: "panelOpacity", label: "面板透明度", hint: "只调整中心底板" }),
                Object.freeze({ key: "glassBlur", label: "玻璃模糊", hint: "增强前后景分离" }),
                Object.freeze({ key: "themeTint", label: "主题染色", hint: "颜色跟随当前皮肤" })
            ])
        }),
        Object.freeze({
            id: "spacing",
            title: "边框与间距",
            icon: "ri-layout-grid-line",
            items: Object.freeze([
                Object.freeze({ key: "frameWidth", label: "边框厚度", hint: "保持九宫格切角比例" }),
                Object.freeze({ key: "contentInset", label: "内容内边距", hint: "文字远离发光边带" }),
                Object.freeze({ key: "panelGap", label: "面板间距", hint: "控制区域之间留白" }),
                Object.freeze({ key: "glowSpread", label: "发光扩散", hint: "不改变边框颜色" }),
                Object.freeze({ key: "controlGap", label: "控件间距", hint: "调整表单与按钮疏密" })
            ])
        }),
        Object.freeze({
            id: "motion",
            title: "动效",
            icon: "ri-sparkling-line",
            items: Object.freeze([
                Object.freeze({ key: "windowMotion", label: "窗口动画", hint: "控制出现与状态过渡" }),
                Object.freeze({ key: "glowMotion", label: "光效流动", hint: "控制边框呼吸强度" })
            ])
        })
    ]);

    /**
     * 把个性化强度限制在统一的 0 至 100 范围。
     * @param {unknown} selPersonalizationValue - range、预设或公开 API 输入，例如 "68"。
     * @param {number} selPersonalizationFallback - 无效输入采用的刷新默认值。
     * @returns {number} 0 至 100 的稳定整数，例如 68。
     */
    function selPersonalizationClamp(selPersonalizationValue, selPersonalizationFallback) {
        // 数字转换兼容原生 range 返回的字符串。
        const selPersonalizationNumber = Number(selPersonalizationValue);
        // 非有限输入直接回退当前字段默认值。
        if (!Number.isFinite(selPersonalizationNumber)) {
            return selPersonalizationFallback;
        }
        // 四舍五入后夹取到统一百分比范围。
        return Math.min(100, Math.max(0, Math.round(selPersonalizationNumber)));
    }

    /**
     * 把 0 至 100 的用户强度线性映射到实际 CSS 像素或毫秒范围。
     * @param {number} selPersonalizationValue - 已归一化的用户百分比。
     * @param {number} selPersonalizationMinimum - CSS 实际下限。
     * @param {number} selPersonalizationMaximum - CSS 实际上限。
     * @returns {number} 保留两位小数的 CSS 实际值。
     */
    function selPersonalizationMap(selPersonalizationValue, selPersonalizationMinimum, selPersonalizationMaximum) {
        // 百分比按线性比例落入组件安全范围。
        return Math.round((selPersonalizationMinimum + ((selPersonalizationMaximum - selPersonalizationMinimum) * selPersonalizationValue / 100)) * 100) / 100;
    }

    /**
     * 把以 50% 为默认的间距强度映射为正负偏移。
     * @param {number} selPersonalizationValue - 已归一化的用户百分比，50 表示保持旧布局。
     * @param {number} selPersonalizationNegativeLimit - 0% 时允许的最大负偏移，例如 -4px。
     * @param {number} selPersonalizationPositiveLimit - 100% 时允许的最大正偏移，例如 10px。
     * @returns {number} 50% 为 0 的安全偏移值。
     */
    function selPersonalizationCenteredMap(selPersonalizationValue, selPersonalizationNegativeLimit, selPersonalizationPositiveLimit) {
        // 低于默认值时从负向极限线性收敛到零。
        if (selPersonalizationValue <= 50) {
            return Math.round((selPersonalizationNegativeLimit * (1 - (selPersonalizationValue / 50))) * 100) / 100;
        }
        // 高于默认值时从零线性扩展到正向极限。
        return Math.round((selPersonalizationPositiveLimit * ((selPersonalizationValue - 50) / 50)) * 100) / 100;
    }

    /**
     * 校验颜色选择器产生的六位十六进制主题色。
     * @param {unknown} selPersonalizationColor - 原生颜色输入或公开默认值，例如 #28D7FF。
     * @returns {string|null} 合法时返回统一大写颜色值，无效时返回 null 并继续跟随皮肤。
     */
    function selPersonalizationNormalizeColor(selPersonalizationColor) {
        // 只有完整六位十六进制颜色能够进入共享主题变量。
        if (typeof selPersonalizationColor !== "string" || !/^#[0-9a-f]{6}$/i.test(selPersonalizationColor)) {
            return null;
        }
        // 大写形式让输出、色板选中态和控制器快照保持一致。
        return selPersonalizationColor.toUpperCase();
    }

    /**
     * 把主题色转换为 CSS RGB 空格通道，供带 Alpha 的水晶材质复用。
     * @param {string} selPersonalizationColor - 已校验的六位十六进制颜色。
     * @returns {string} CSS Color 4 RGB 通道，例如 "40 215 255"。
     */
    function selPersonalizationColorToRgb(selPersonalizationColor) {
        // 三个通道分别从十六进制颜色中解析。
        const selPersonalizationRed = Number.parseInt(selPersonalizationColor.slice(1, 3), 16);
        const selPersonalizationGreen = Number.parseInt(selPersonalizationColor.slice(3, 5), 16);
        const selPersonalizationBlue = Number.parseInt(selPersonalizationColor.slice(5, 7), 16);
        // 空格分隔格式可直接放入 rgb(var(--token) / alpha)。
        return `${selPersonalizationRed} ${selPersonalizationGreen} ${selPersonalizationBlue}`;
    }

    /**
     * 读取当前皮肤主题色并转换为颜色输入可显示的十六进制值。
     * @param {Element} selPersonalizationRoot - 承载皮肤 CSS 变量的页面根节点。
     * @returns {string} 当前皮肤颜色，例如 #4A8BFF。
     */
    function selPersonalizationReadSkinColor(selPersonalizationRoot) {
        // 当前皮肤通过 glow RGB 令牌提供默认统一主题色。
        const selPersonalizationChannels = getComputedStyle(selPersonalizationRoot)
            .getPropertyValue("--selpersonal-theme-glow-rgb")
            .trim()
            .split(/\s+/)
            .map(Number);
        // 无效皮肤变量安全回退到基础水晶蓝，只用于颜色输入的可见值。
        if (selPersonalizationChannels.length !== 3 || selPersonalizationChannels.some((selPersonalizationChannel) => !Number.isFinite(selPersonalizationChannel))) {
            return "#4A8BFF";
        }
        // 每个 RGB 通道夹取后补足两位十六进制。
        return `#${selPersonalizationChannels.map((selPersonalizationChannel) => Math.min(255, Math.max(0, Math.round(selPersonalizationChannel))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    }

    /**
     * 加载水晶九宫格原图，为运行时统一主题色生成同结构着色版本。
     * @returns {Promise<HTMLImageElement>} 成功时返回同源图片元素。
     */
    function selPersonalizationLoadFrameImage() {
        // 首次调用创建加载任务，后续颜色直接复用同一结果。
        if (!selPersonalizationFrameImagePromise) {
            selPersonalizationFrameImagePromise = new Promise((selPersonalizationResolve, selPersonalizationReject) => {
                // Image 保持原始透明通道和九宫格像素尺寸。
                const selPersonalizationImage = new Image();
                // 同源图片加载完成后允许 Canvas 读取像素并导出临时 data URL。
                selPersonalizationImage.addEventListener("load", () => selPersonalizationResolve(selPersonalizationImage), { once: true });
                // 素材异常时拒绝着色任务，页面继续使用皮肤默认边框。
                selPersonalizationImage.addEventListener("error", () => selPersonalizationReject(new Error("个性化水晶边框素材加载失败。")), { once: true });
                // 最后设置地址，确保缓存命中时也已经注册完成事件。
                selPersonalizationImage.src = selPersonalizationFrameSource;
            });
        }
        // 返回当前页面唯一加载任务。
        return selPersonalizationFrameImagePromise;
    }

    /**
     * 使用真实九宫格素材生成保留亮暗细节的临时主题色边框。
     * @param {string} selPersonalizationColor - 已校验的六位十六进制颜色。
     * @returns {Promise<string>} 可写入 border-image-source 的 WebP data URL。
     */
    async function selPersonalizationCreateTintedFrame(selPersonalizationColor) {
        // 同色结果直接复用，避免重复进行 Canvas 合成。
        if (selPersonalizationFrameColorCache.has(selPersonalizationColor)) {
            return selPersonalizationFrameColorCache.get(selPersonalizationColor);
        }
        // 等待同源九宫格原图可用。
        const selPersonalizationImage = await selPersonalizationLoadFrameImage();
        // 离屏 Canvas 尺寸严格保持原素材，不重新拉伸边角细节。
        const selPersonalizationCanvas = document.createElement("canvas");
        selPersonalizationCanvas.width = selPersonalizationImage.naturalWidth;
        selPersonalizationCanvas.height = selPersonalizationImage.naturalHeight;
        // 2D 上下文负责保留原图透明度与明暗层次。
        const selPersonalizationContext = selPersonalizationCanvas.getContext("2d");
        if (!selPersonalizationContext) {
            throw new Error("浏览器不支持个性化边框着色。");
        }
        // 先绘制完整原始材质。
        selPersonalizationContext.drawImage(selPersonalizationImage, 0, 0);
        // source-atop 只给已有不透明像素上色，透明切角与中心不会被填满。
        selPersonalizationContext.globalCompositeOperation = "source-atop";
        // 72% 主题色与 28% 原材质混合，保留原图高光和折射细节。
        selPersonalizationContext.globalAlpha = 0.72;
        selPersonalizationContext.fillStyle = selPersonalizationColor;
        selPersonalizationContext.fillRect(0, 0, selPersonalizationCanvas.width, selPersonalizationCanvas.height);
        // WebP data URL 只驻留内存，不写入运行素材目录或浏览器存储。
        const selPersonalizationTintedFrame = `url("${selPersonalizationCanvas.toDataURL("image/webp", 0.92)}")`;
        // 缓存当前颜色，连续切换常用色时减少计算。
        selPersonalizationFrameColorCache.set(selPersonalizationColor, selPersonalizationTintedFrame);
        // 返回可直接使用的 CSS 图片值。
        return selPersonalizationTintedFrame;
    }

    /**
     * 显式挂载个性化设置界面。
     * @param {Element} selPersonalizationHost - HTML 提供的个性化入口挂载点。
     * @param {object} selPersonalizationOptions - 背景控制器和可选默认值。
     * @returns {object|null} 成功时返回当前页面个性化控制器。
     */
    function selPersonalizationMount(selPersonalizationHost, selPersonalizationOptions = {}) {
        // 非元素宿主不能承载设置入口和浮动面板。
        if (!(selPersonalizationHost instanceof Element)) {
            return null;
        }
        // 同一宿主重复挂载时复用已有控制器。
        if (selPersonalizationControllers.has(selPersonalizationHost)) {
            return selPersonalizationControllers.get(selPersonalizationHost);
        }
        // 背景控制器必须提供主题、状态与调整 API，组合控件不得绕过它修改背景内部状态。
        const selPersonalizationBackgroundController = selPersonalizationOptions.backgroundController;
        // 缺少标准背景控制器时不创建只有半套功能的设置面板。
        if (!selPersonalizationBackgroundController?.themes || typeof selPersonalizationBackgroundController.setDisplay !== "function") {
            return null;
        }
        // 页面根节点承载跨组件共享的视觉令牌。
        const selPersonalizationDocumentRoot = document.documentElement;
        // 调用方可以覆盖面板刷新默认值，但每个强度仍会限制到 0 至 100。
        const selPersonalizationDefaults = Object.freeze({
            ...selPersonalizationPanelDefaults,
            ...(selPersonalizationOptions.defaults || {})
        });
        // 当前面板状态只保存在内存中，刷新页面自动重新使用默认值。
        let selPersonalizationPanelState = {
            ...selPersonalizationDefaults,
            // 调用方默认色也必须通过统一校验；null 继续表示跟随皮肤。
            themeColor: selPersonalizationNormalizeColor(selPersonalizationDefaults.themeColor),
            reducedMotion: Boolean(selPersonalizationDefaults.reducedMotion)
        };
        // 递增请求编号避免快速拖动颜色时较旧的异步边框结果覆盖最新选择。
        let selPersonalizationFrameRequest = 0;
        // 两个一级设置使用原生 tab 语义，背景功能继续作为独立一级区域。
        selPersonalizationHost.innerHTML = `
            <aside class="selpersonal-control" data-sel-personal-control aria-label="个性化设置">
                <button class="selpersonal-trigger" type="button" data-sel-personal-action="toggle" aria-label="打开个性化设置" aria-expanded="false">
                    <i class="ri-equalizer-2-line" aria-hidden="true"></i>
                </button>
                <section class="selpersonal-panel" data-sel-personal-panel role="dialog" aria-label="个性化设置" hidden>
                    <header class="selpersonal-heading">
                        <span class="selpersonal-heading-icon" aria-hidden="true"><i class="ri-magic-line"></i></span>
                        <span class="selpersonal-heading-copy"><strong>个性化设置</strong><small>当前页面实时预览</small></span>
                        <button class="selpersonal-close" type="button" data-sel-personal-action="close" aria-label="关闭个性化设置"><i class="ri-close-line" aria-hidden="true"></i></button>
                    </header>
                    <div class="selpersonal-tabs" role="tablist" aria-label="个性化设置分类">
                        <button class="selpersonal-tab selpersonal-tab-selected" type="button" role="tab" aria-selected="true" aria-controls="selpersonal-background-view" data-sel-personal-tab="background"><i class="ri-landscape-line" aria-hidden="true"></i><span>背景设置</span></button>
                        <button class="selpersonal-tab" type="button" role="tab" aria-selected="false" aria-controls="selpersonal-panel-view" data-sel-personal-tab="panel"><i class="ri-layout-4-line" aria-hidden="true"></i><span>面板设置</span></button>
                    </div>
                    <div class="selpersonal-view" id="selpersonal-background-view" role="tabpanel" data-sel-personal-view="background">
                        <header class="selpersonal-view-heading"><strong>选择网页背景</strong><span>${selPersonalizationBackgroundController.themes.length} 种独立主题</span></header>
                        <div class="selpersonal-background-grid" data-sel-personal-background-grid aria-label="背景主题"></div>
                        <div class="selpersonal-group selpersonal-background-adjustments" aria-label="背景显示参数">
                            <label class="selpersonal-range"><span>遮罩</span><input type="range" min="0" max="85" step="1" data-sel-personal-background-range="overlay"><output data-sel-personal-background-output="overlay"></output></label>
                            <label class="selpersonal-range"><span>亮度</span><input type="range" min="45" max="120" step="1" data-sel-personal-background-range="brightness"><output data-sel-personal-background-output="brightness"></output></label>
                            <label class="selpersonal-range"><span>模糊</span><input type="range" min="0" max="12" step="1" data-sel-personal-background-range="blur"><output data-sel-personal-background-output="blur"></output></label>
                        </div>
                        <button class="selpersonal-reset" type="button" data-sel-personal-action="reset-background"><i class="ri-restart-line" aria-hidden="true"></i><span>恢复背景默认</span></button>
                    </div>
                    <div class="selpersonal-view" id="selpersonal-panel-view" role="tabpanel" data-sel-personal-view="panel" hidden>
                        <section class="selpersonal-preset-section" aria-labelledby="selpersonal-preset-title">
                            <header class="selpersonal-section-heading"><span><i class="ri-bookmark-3-line" aria-hidden="true"></i><strong id="selpersonal-preset-title">面板预设</strong></span><small>不保存，刷新恢复默认</small></header>
                            <div class="selpersonal-presets" data-sel-personal-presets></div>
                        </section>
                        <div class="selpersonal-panel-scroll" data-sel-personal-panel-scroll></div>
                        <button class="selpersonal-reset" type="button" data-sel-personal-action="reset-panel"><i class="ri-restart-line" aria-hidden="true"></i><span>恢复面板默认</span></button>
                    </div>
                </section>
            </aside>
        `;
        // 固定节点集中缓存，后续状态同步不重复查询整个页面。
        const selPersonalizationControl = selPersonalizationHost.querySelector("[data-sel-personal-control]");
        const selPersonalizationTrigger = selPersonalizationHost.querySelector("[data-sel-personal-action='toggle']");
        const selPersonalizationPanel = selPersonalizationHost.querySelector("[data-sel-personal-panel]");
        const selPersonalizationBackgroundGrid = selPersonalizationHost.querySelector("[data-sel-personal-background-grid]");
        const selPersonalizationPanelScroll = selPersonalizationHost.querySelector("[data-sel-personal-panel-scroll]");
        const selPersonalizationPresetGrid = selPersonalizationHost.querySelector("[data-sel-personal-presets]");
        // 任一关键节点缺失都阻止创建不可完整操作的控制器。
        if (!selPersonalizationControl || !selPersonalizationTrigger || !selPersonalizationPanel || !selPersonalizationBackgroundGrid || !selPersonalizationPanelScroll || !selPersonalizationPresetGrid) {
            return null;
        }

        // 背景缩略图按钮直接复用背景控制器提供的正式素材与稳定主题标识。
        selPersonalizationBackgroundController.themes.forEach((selPersonalizationTheme) => {
            // 原生按钮承担可访问的选中语义。
            const selPersonalizationThemeButton = document.createElement("button");
            selPersonalizationThemeButton.className = "selpersonal-background-option";
            selPersonalizationThemeButton.type = "button";
            selPersonalizationThemeButton.dataset.selPersonalBackgroundTheme = selPersonalizationTheme.id;
            selPersonalizationThemeButton.style.setProperty("--selpersonal-theme-thumbnail", selPersonalizationTheme.image ? `url("${selPersonalizationTheme.image}")` : "none");
            selPersonalizationThemeButton.setAttribute("aria-pressed", "false");
            // 主题名称和分类保持实时 DOM，便于换肤与国际化。
            const selPersonalizationThemeCopy = document.createElement("span");
            selPersonalizationThemeCopy.className = "selpersonal-background-option-copy";
            const selPersonalizationThemeName = document.createElement("strong");
            selPersonalizationThemeName.textContent = selPersonalizationTheme.name;
            const selPersonalizationThemeCategory = document.createElement("span");
            selPersonalizationThemeCategory.textContent = selPersonalizationTheme.category;
            selPersonalizationThemeCopy.append(selPersonalizationThemeName, selPersonalizationThemeCategory);
            selPersonalizationThemeButton.appendChild(selPersonalizationThemeCopy);
            selPersonalizationBackgroundGrid.appendChild(selPersonalizationThemeButton);
        });

        // 预设按钮只应用稳定强度组合，颜色继续由当前皮肤提供。
        selPersonalizationPresets.forEach((selPersonalizationPreset) => {
            // 每个预设使用原生按钮和现有 Remix Icon。
            const selPersonalizationPresetButton = document.createElement("button");
            selPersonalizationPresetButton.className = "selpersonal-preset";
            selPersonalizationPresetButton.type = "button";
            selPersonalizationPresetButton.dataset.selPersonalPreset = selPersonalizationPreset.id;
            selPersonalizationPresetButton.setAttribute("aria-pressed", "false");
            selPersonalizationPresetButton.innerHTML = `<i class="${selPersonalizationPreset.icon}" aria-hidden="true"></i><span>${selPersonalizationPreset.label}</span>`;
            selPersonalizationPresetGrid.appendChild(selPersonalizationPresetButton);
        });

        // 面板分组根据固定配置生成一致的 range 行。
        selPersonalizationPanelRangeGroups.forEach((selPersonalizationGroup) => {
            // 每个分组拥有独立标题与业务说明区域。
            const selPersonalizationSection = document.createElement("section");
            selPersonalizationSection.className = "selpersonal-section";
            selPersonalizationSection.dataset.selPersonalGroup = selPersonalizationGroup.id;
            const selPersonalizationSectionHeader = document.createElement("header");
            selPersonalizationSectionHeader.className = "selpersonal-section-heading";
            selPersonalizationSectionHeader.innerHTML = `<span><i class="${selPersonalizationGroup.icon}" aria-hidden="true"></i><strong>${selPersonalizationGroup.title}</strong></span>`;
            selPersonalizationSection.appendChild(selPersonalizationSectionHeader);
            // 外观分组先提供统一主题色，再由染色强度决定颜色介入程度。
            if (selPersonalizationGroup.id === "appearance") {
                // 原生 color 支持任意颜色，色板按钮提供常用颜色的快速路径。
                const selPersonalizationColorSetting = document.createElement("div");
                selPersonalizationColorSetting.className = "selpersonal-color-setting";
                selPersonalizationColorSetting.innerHTML = `
                    <div class="selpersonal-color-heading">
                        <span class="selpersonal-panel-range-copy"><strong>统一主题色</strong><small>边框、发光与交互强调色</small></span>
                        <label class="selpersonal-color-picker"><input type="color" data-sel-personal-theme-color aria-label="选择统一主题色"><output data-sel-personal-theme-color-output></output></label>
                    </div>
                    <div class="selpersonal-color-actions">
                        <button class="selpersonal-color-follow" type="button" data-sel-personal-theme-follow aria-pressed="true"><i class="ri-brush-line" aria-hidden="true"></i><span>跟随皮肤</span></button>
                        <div class="selpersonal-color-swatches" data-sel-personal-theme-swatches aria-label="常用主题色"></div>
                    </div>
                `;
                // 常用色以真实颜色输入的快捷按钮呈现，并保留可访问名称。
                const selPersonalizationSwatches = selPersonalizationColorSetting.querySelector("[data-sel-personal-theme-swatches]");
                selPersonalizationThemeColors.forEach((selPersonalizationThemeColor) => {
                    // 每个色板按钮通过 CSS 变量显示实际颜色，不使用图片或伪造图标。
                    const selPersonalizationSwatch = document.createElement("button");
                    selPersonalizationSwatch.className = "selpersonal-color-swatch";
                    selPersonalizationSwatch.type = "button";
                    selPersonalizationSwatch.dataset.selPersonalThemeSwatch = selPersonalizationThemeColor.value;
                    selPersonalizationSwatch.style.setProperty("--selpersonal-swatch-color", selPersonalizationThemeColor.value);
                    selPersonalizationSwatch.setAttribute("aria-label", selPersonalizationThemeColor.label);
                    selPersonalizationSwatch.setAttribute("aria-pressed", "false");
                    selPersonalizationSwatches?.appendChild(selPersonalizationSwatch);
                });
                // 颜色设置属于外观分组内容，位于强度滑杆之前。
                selPersonalizationSection.appendChild(selPersonalizationColorSetting);
            }
            // 当前分组中的每项设置共享百分比输入结构。
            selPersonalizationGroup.items.forEach((selPersonalizationItem) => {
                // label 让名称、range 和输出具备原生关联。
                const selPersonalizationRange = document.createElement("label");
                selPersonalizationRange.className = "selpersonal-panel-range";
                selPersonalizationRange.innerHTML = `
                    <span class="selpersonal-panel-range-copy"><strong>${selPersonalizationItem.label}</strong><small>${selPersonalizationItem.hint}</small></span>
                    <span class="selpersonal-panel-range-control"><input type="range" min="0" max="100" step="1" data-sel-personal-panel-range="${selPersonalizationItem.key}"><output data-sel-personal-panel-output="${selPersonalizationItem.key}"></output></span>
                `;
                selPersonalizationSection.appendChild(selPersonalizationRange);
            });
            // 动效分组追加独立的减少动态效果开关。
            if (selPersonalizationGroup.id === "motion") {
                // checkbox 不伪装成强度滑杆，语义与系统减少动态偏好一致。
                const selPersonalizationMotionToggle = document.createElement("label");
                selPersonalizationMotionToggle.className = "selpersonal-toggle";
                selPersonalizationMotionToggle.innerHTML = `
                    <span><strong>减少动态效果</strong><small>关闭窗口动画与光效流动</small></span>
                    <input type="checkbox" data-sel-personal-reduced-motion>
                    <span class="selpersonal-toggle-track" aria-hidden="true"><span></span></span>
                `;
                selPersonalizationSection.appendChild(selPersonalizationMotionToggle);
            }
            selPersonalizationPanelScroll.appendChild(selPersonalizationSection);
        });

        /**
         * 同步背景主题、参数和输出文案。
         * @returns {void} 只读取背景控制器并更新个性化界面。
         */
        function selPersonalizationSyncBackground() {
            // 背景状态始终从背景控制器读取，组合界面不维护第二套业务值。
            const selPersonalizationBackgroundState = selPersonalizationBackgroundController.getState();
            // 主题按钮根据当前背景同步 pressed 状态。
            selPersonalizationBackgroundGrid.querySelectorAll("[data-sel-personal-background-theme]").forEach((selPersonalizationThemeButton) => {
                selPersonalizationThemeButton.setAttribute("aria-pressed", String(selPersonalizationThemeButton.dataset.selPersonalBackgroundTheme === selPersonalizationBackgroundState.theme));
            });
            // 三个背景参数继续保持既有单位和范围。
            ["overlay", "brightness", "blur"].forEach((selPersonalizationParameter) => {
                const selPersonalizationRange = selPersonalizationControl.querySelector(`[data-sel-personal-background-range="${selPersonalizationParameter}"]`);
                const selPersonalizationOutput = selPersonalizationControl.querySelector(`[data-sel-personal-background-output="${selPersonalizationParameter}"]`);
                // range 使用背景控制器返回的真实数值。
                if (selPersonalizationRange) {
                    selPersonalizationRange.value = String(selPersonalizationBackgroundState[selPersonalizationParameter]);
                }
                // 模糊显示 px，遮罩与亮度继续显示百分比。
                if (selPersonalizationOutput) {
                    selPersonalizationOutput.value = selPersonalizationParameter === "blur" ? `${selPersonalizationBackgroundState.blur}px` : `${selPersonalizationBackgroundState[selPersonalizationParameter]}%`;
                }
            });
        }

        /**
         * 把面板强度映射为所有水晶组件共享的 CSS 令牌。
         * @returns {void} 实时改变当前页面，不写入 localStorage 或其他缓存。
         */
        function selPersonalizationApplyPanel() {
            // 自定义颜色写入统一主题 RGB；跟随皮肤时移除行内值，让当前皮肤令牌重新生效。
            const selPersonalizationThemeColor = selPersonalizationNormalizeColor(selPersonalizationPanelState.themeColor);
            // 本次应用拥有独立请求编号，后续异步结果必须与它匹配。
            const selPersonalizationCurrentFrameRequest = ++selPersonalizationFrameRequest;
            if (selPersonalizationThemeColor) {
                selPersonalizationDocumentRoot.style.setProperty("--selpersonal-theme-color-rgb", selPersonalizationColorToRgb(selPersonalizationThemeColor));
                // 真实九宫格素材在内存中着色后替换全部共享边框。
                selPersonalizationCreateTintedFrame(selPersonalizationThemeColor)
                    .then((selPersonalizationTintedFrame) => {
                        // 只提交仍为当前颜色的最新请求，防止快速选色闪回旧边框。
                        if (selPersonalizationCurrentFrameRequest === selPersonalizationFrameRequest && selPersonalizationPanelState.themeColor === selPersonalizationThemeColor) {
                            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-frame-image", selPersonalizationTintedFrame);
                        }
                    })
                    .catch(() => {
                        // 着色能力失败时保留原始皮肤边框，统一主题色的发光和控件仍然可用。
                        if (selPersonalizationCurrentFrameRequest === selPersonalizationFrameRequest) {
                            selPersonalizationDocumentRoot.style.removeProperty("--selpersonal-frame-image");
                        }
                    });
            } else {
                selPersonalizationDocumentRoot.style.removeProperty("--selpersonal-theme-color-rgb");
                // 跟随皮肤时立即恢复皮肤提供的原始九宫格素材。
                selPersonalizationDocumentRoot.style.removeProperty("--selpersonal-frame-image");
            }
            // 中心底板透明度只作用于背景色，不降低文字、图标或边框 Alpha。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-panel-opacity", String(selPersonalizationPanelState.panelOpacity / 100));
            // 玻璃模糊映射到 0 至 24px 的安全范围。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-panel-blur", `${selPersonalizationMap(selPersonalizationPanelState.glassBlur, 0, 24)}px`);
            // 染色强度只写比例；未来皮肤通过覆盖主题 RGB 令牌换色。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-theme-tint-strength", `${selPersonalizationPanelState.themeTint}%`);
            // 中心底板最多混入 32% 主题色，让整套皮肤能够明显脱离原始蓝色且保持文字可读。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-theme-tint-mix", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 32)}%`);
            // 结构层按同一强度生成柔和、基础、抬升和强调色阶，组件不再各自写死蓝色底板。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-skin-soft-mix", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 22)}%`);
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-skin-base-mix", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 34)}%`);
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-skin-raised-mix", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 48)}%`);
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-skin-accent-mix", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 78)}%`);
            // 边框厚度映射为 0.67 至 1.33 的统一缩放比例，50% 保持每个组件自己的原始厚度。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-frame-scale", String(selPersonalizationMap(selPersonalizationPanelState.frameWidth, 0.67, 1.33)));
            // 内容内边距把 0 至 100 映射为 -4 至 10px 的偏移量，默认 50 严格保持旧布局。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-content-inset-offset", `${selPersonalizationCenteredMap(selPersonalizationPanelState.contentInset, -4, 10)}px`);
            // 面板间距限制在 6 至 14px，保证紧凑视口仍保留中央内容。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-panel-gap", `${selPersonalizationMap(selPersonalizationPanelState.panelGap, 6, 14)}px`);
            // 发光扩散映射到 0 至 22px，并单独写强度供动效使用。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-glow-spread", `${selPersonalizationMap(selPersonalizationPanelState.glowSpread, 0, 22)}px`);
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-glow-strength", String(selPersonalizationPanelState.glowSpread / 100));
            // 控件间距映射为 -3 至 7px 的局部偏移，默认 50 保持旧密度且不改变最小点击尺寸。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-control-gap-offset", `${selPersonalizationCenteredMap(selPersonalizationPanelState.controlGap, -3, 7)}px`);
            // 窗口动画强度同时决定入场时长和位移幅度。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-window-motion-duration", `${selPersonalizationMap(selPersonalizationPanelState.windowMotion, 0, 300)}ms`);
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-window-motion-distance", `${selPersonalizationMap(selPersonalizationPanelState.windowMotion, 0, 14)}px`);
            // 光效流动写入不透明度和周期；0% 时 CSS 会直接停止动画。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-glow-motion-strength", String(selPersonalizationPanelState.glowMotion / 100));
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-glow-motion-duration", `${selPersonalizationMap(100 - selPersonalizationPanelState.glowMotion, 3.2, 10)}s`);
            // 页面标识统一控制用户开关和系统减少动态偏好的降级路径。
            selPersonalizationDocumentRoot.dataset.selPersonalReducedMotion = String(selPersonalizationPanelState.reducedMotion);
            selPersonalizationDocumentRoot.dataset.selPersonalPreset = selPersonalizationPanelState.preset;
            // 设置界面同步当前强度、开关和预设选中态。
            selPersonalizationSyncPanel();
            // 页面级事件供窗口或未来皮肤读取当前强度，不暴露可变内部对象。
            document.dispatchEvent(new CustomEvent("selPersonalization:change", {
                detail: Object.freeze({ ...selPersonalizationPanelState })
            }));
        }

        /**
         * 同步面板 range、开关和预设按钮。
         * @returns {void} 只更新控件显示，不再次应用 CSS。
         */
        function selPersonalizationSyncPanel() {
            // 所有面板 range 输出统一采用百分比。
            selPersonalizationControl.querySelectorAll("[data-sel-personal-panel-range]").forEach((selPersonalizationRange) => {
                const selPersonalizationKey = selPersonalizationRange.dataset.selPersonalPanelRange;
                const selPersonalizationOutput = selPersonalizationControl.querySelector(`[data-sel-personal-panel-output="${selPersonalizationKey}"]`);
                // 当前状态写入原生 range。
                selPersonalizationRange.value = String(selPersonalizationPanelState[selPersonalizationKey]);
                // 输出始终显示 0 至 100 百分比。
                if (selPersonalizationOutput) {
                    selPersonalizationOutput.value = `${selPersonalizationPanelState[selPersonalizationKey]}%`;
                }
            });
            // 独立开关反映当前减少动态状态。
            const selPersonalizationReducedMotion = selPersonalizationControl.querySelector("[data-sel-personal-reduced-motion]");
            if (selPersonalizationReducedMotion) {
                selPersonalizationReducedMotion.checked = selPersonalizationPanelState.reducedMotion;
            }
            // 颜色输入始终显示当前有效颜色；输出区分自定义色与跟随皮肤状态。
            const selPersonalizationThemeColorInput = selPersonalizationControl.querySelector("[data-sel-personal-theme-color]");
            const selPersonalizationThemeColorOutput = selPersonalizationControl.querySelector("[data-sel-personal-theme-color-output]");
            const selPersonalizationEffectiveColor = selPersonalizationNormalizeColor(selPersonalizationPanelState.themeColor) || selPersonalizationReadSkinColor(selPersonalizationDocumentRoot);
            if (selPersonalizationThemeColorInput) {
                selPersonalizationThemeColorInput.value = selPersonalizationEffectiveColor;
            }
            if (selPersonalizationThemeColorOutput) {
                selPersonalizationThemeColorOutput.value = selPersonalizationPanelState.themeColor ? selPersonalizationEffectiveColor : "跟随皮肤";
            }
            // 跟随按钮和常用色按钮同步当前颜色来源及精确选中态。
            selPersonalizationControl.querySelector("[data-sel-personal-theme-follow]")?.setAttribute("aria-pressed", String(!selPersonalizationPanelState.themeColor));
            selPersonalizationControl.querySelectorAll("[data-sel-personal-theme-swatch]").forEach((selPersonalizationSwatch) => {
                selPersonalizationSwatch.setAttribute("aria-pressed", String(selPersonalizationSwatch.dataset.selPersonalThemeSwatch === selPersonalizationPanelState.themeColor));
            });
            // 预设按钮只标记当前匹配的预设或自定义状态。
            selPersonalizationPresetGrid.querySelectorAll("[data-sel-personal-preset]").forEach((selPersonalizationPresetButton) => {
                selPersonalizationPresetButton.setAttribute("aria-pressed", String(selPersonalizationPresetButton.dataset.selPersonalPreset === selPersonalizationPanelState.preset));
            });
        }

        /**
         * 切换两个一级设置视图。
         * @param {string} selPersonalizationViewName - background 或 panel。
         * @returns {boolean} 成功切换时返回 true。
         */
        function selPersonalizationSelectView(selPersonalizationViewName) {
            // 未知视图不会隐藏当前有效界面。
            if (!["background", "panel"].includes(selPersonalizationViewName)) {
                return false;
            }
            // tab 同步选中类和 aria-selected。
            selPersonalizationControl.querySelectorAll("[data-sel-personal-tab]").forEach((selPersonalizationTab) => {
                const selPersonalizationSelected = selPersonalizationTab.dataset.selPersonalTab === selPersonalizationViewName;
                selPersonalizationTab.classList.toggle("selpersonal-tab-selected", selPersonalizationSelected);
                selPersonalizationTab.setAttribute("aria-selected", String(selPersonalizationSelected));
            });
            // 只显示当前一级设置对应的 tabpanel。
            selPersonalizationControl.querySelectorAll("[data-sel-personal-view]").forEach((selPersonalizationView) => {
                selPersonalizationView.hidden = selPersonalizationView.dataset.selPersonalView !== selPersonalizationViewName;
            });
            // true 表示视图切换已完成。
            return true;
        }

        // 入口按钮展开或收起整个个性化面板。
        selPersonalizationTrigger.addEventListener("click", () => {
            // hidden 状态是面板开关的唯一真实来源。
            const selPersonalizationOpen = selPersonalizationPanel.hidden;
            selPersonalizationPanel.hidden = !selPersonalizationOpen;
            selPersonalizationTrigger.setAttribute("aria-expanded", String(selPersonalizationOpen));
        });
        // 关闭按钮提供明确的鼠标和键盘关闭路径。
        selPersonalizationControl.querySelector("[data-sel-personal-action='close']")?.addEventListener("click", () => {
            // 收起面板并同步入口展开语义。
            selPersonalizationPanel.hidden = true;
            selPersonalizationTrigger.setAttribute("aria-expanded", "false");
            selPersonalizationTrigger.focus();
        });
        // tablist 使用事件委托切换两个一级设置。
        selPersonalizationControl.querySelector(".selpersonal-tabs")?.addEventListener("click", (selPersonalizationEvent) => {
            // 只响应带稳定 tab 标识的按钮。
            const selPersonalizationTab = selPersonalizationEvent.target.closest("[data-sel-personal-tab]");
            if (selPersonalizationTab) {
                selPersonalizationSelectView(selPersonalizationTab.dataset.selPersonalTab);
            }
        });
        // tablist 支持方向键和首尾键，键盘用户不必离开分类导航。
        selPersonalizationControl.querySelector(".selpersonal-tabs")?.addEventListener("keydown", (selPersonalizationEvent) => {
            // 当前两个 tab 按 DOM 顺序形成稳定键盘列表。
            const selPersonalizationTabs = Array.from(selPersonalizationControl.querySelectorAll("[data-sel-personal-tab]"));
            // 只有焦点位于 tab 时才处理分类导航按键。
            const selPersonalizationCurrentIndex = selPersonalizationTabs.indexOf(selPersonalizationEvent.target);
            if (selPersonalizationCurrentIndex < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(selPersonalizationEvent.key)) {
                return;
            }
            // 阻止方向键滚动浮层内容。
            selPersonalizationEvent.preventDefault();
            // Home 和 End 直达首尾；左右方向在两个一级设置之间循环。
            const selPersonalizationNextIndex = selPersonalizationEvent.key === "Home"
                ? 0
                : selPersonalizationEvent.key === "End"
                    ? selPersonalizationTabs.length - 1
                    : (selPersonalizationCurrentIndex + (selPersonalizationEvent.key === "ArrowRight" ? 1 : -1) + selPersonalizationTabs.length) % selPersonalizationTabs.length;
            // 焦点和选中视图同步移动。
            selPersonalizationTabs[selPersonalizationNextIndex].focus();
            selPersonalizationSelectView(selPersonalizationTabs[selPersonalizationNextIndex].dataset.selPersonalTab);
        });
        // 背景主题按钮继续调用背景控制器，不直接写图片变量。
        selPersonalizationBackgroundGrid.addEventListener("click", (selPersonalizationEvent) => {
            // 找到实际点击的主题按钮。
            const selPersonalizationThemeButton = selPersonalizationEvent.target.closest("[data-sel-personal-background-theme]");
            if (!selPersonalizationThemeButton) {
                return;
            }
            // 合法主题由背景控制器验证并应用。
            selPersonalizationBackgroundController.setTheme(selPersonalizationThemeButton.dataset.selPersonalBackgroundTheme);
            // 背景界面同步主题选中态。
            selPersonalizationSyncBackground();
        });
        // 三个背景 range 共享标准 setDisplay 路径。
        selPersonalizationControl.querySelectorAll("[data-sel-personal-background-range]").forEach((selPersonalizationRange) => {
            selPersonalizationRange.addEventListener("input", () => {
                // 当前 range 名称对应背景控制器的显示字段。
                const selPersonalizationParameter = selPersonalizationRange.dataset.selPersonalBackgroundRange;
                // 只把当前字段交给背景控制器，其他字段保持不变。
                selPersonalizationBackgroundController.setDisplay({ [selPersonalizationParameter]: selPersonalizationRange.value });
                // 实时输出更新到当前真实值。
                selPersonalizationSyncBackground();
            });
        });
        // 面板 range 改动后进入自定义状态并实时应用页面令牌。
        selPersonalizationControl.querySelectorAll("[data-sel-personal-panel-range]").forEach((selPersonalizationRange) => {
            selPersonalizationRange.addEventListener("input", () => {
                // range 数据键只来自固定配置。
                const selPersonalizationKey = selPersonalizationRange.dataset.selPersonalPanelRange;
                // 当前字段使用自己的默认值完成范围归一化。
                selPersonalizationPanelState = {
                    ...selPersonalizationPanelState,
                    [selPersonalizationKey]: selPersonalizationClamp(selPersonalizationRange.value, selPersonalizationDefaults[selPersonalizationKey]),
                    preset: "custom"
                };
                // 新状态即时作用于所有水晶组件。
                selPersonalizationApplyPanel();
            });
        });
        // 原生颜色输入允许用户选择色板之外的任意统一主题色。
        selPersonalizationControl.querySelector("[data-sel-personal-theme-color]")?.addEventListener("input", (selPersonalizationEvent) => {
            // 合法颜色进入当前页面自定义状态。
            selPersonalizationPanelState = { ...selPersonalizationPanelState, themeColor: selPersonalizationNormalizeColor(selPersonalizationEvent.target.value), preset: "custom" };
            // 新颜色即时覆盖所有水晶组件的共享主题变量。
            selPersonalizationApplyPanel();
        });
        // 跟随皮肤按钮清除临时颜色覆盖，不改变其他面板强度。
        selPersonalizationControl.querySelector("[data-sel-personal-theme-follow]")?.addEventListener("click", () => {
            // null 让 CSS 重新读取皮肤默认主题色。
            selPersonalizationPanelState = { ...selPersonalizationPanelState, themeColor: null, preset: "custom" };
            // 立即恢复当前皮肤颜色。
            selPersonalizationApplyPanel();
        });
        // 常用色按钮统一走与颜色输入相同的状态路径。
        selPersonalizationControl.querySelector("[data-sel-personal-theme-swatches]")?.addEventListener("click", (selPersonalizationEvent) => {
            // 只响应带颜色数据的原生按钮。
            const selPersonalizationSwatch = selPersonalizationEvent.target.closest("[data-sel-personal-theme-swatch]");
            if (!selPersonalizationSwatch) {
                return;
            }
            // 色板值已在固定配置中定义，仍经过统一校验后写入。
            selPersonalizationPanelState = { ...selPersonalizationPanelState, themeColor: selPersonalizationNormalizeColor(selPersonalizationSwatch.dataset.selPersonalThemeSwatch), preset: "custom" };
            // 所有共享水晶表面即时响应。
            selPersonalizationApplyPanel();
        });
        // 减少动态效果开关关闭所有窗口动画和光效流动。
        selPersonalizationControl.querySelector("[data-sel-personal-reduced-motion]")?.addEventListener("change", (selPersonalizationEvent) => {
            // 开关状态与自定义预设一起保存到当前页面内存。
            selPersonalizationPanelState = { ...selPersonalizationPanelState, reducedMotion: selPersonalizationEvent.target.checked, preset: "custom" };
            // 页面根标识立即触发动效降级规则。
            selPersonalizationApplyPanel();
        });
        // 预设按钮一次应用一组与皮肤无关的强度值。
        selPersonalizationPresetGrid.addEventListener("click", (selPersonalizationEvent) => {
            // 找到稳定预设按钮。
            const selPersonalizationPresetButton = selPersonalizationEvent.target.closest("[data-sel-personal-preset]");
            if (!selPersonalizationPresetButton) {
                return;
            }
            // 自定义按钮只标识当前自由调节状态，不覆盖用户现有值。
            const selPersonalizationPreset = selPersonalizationPresets.find((selPersonalizationItem) => selPersonalizationItem.id === selPersonalizationPresetButton.dataset.selPersonalPreset);
            if (!selPersonalizationPreset) {
                return;
            }
            // 有固定值的预设替换全部面板字段；自定义只改变当前标识。
            selPersonalizationPanelState = selPersonalizationPreset.values
                ? { ...selPersonalizationPanelState, ...selPersonalizationPreset.values, preset: selPersonalizationPreset.id }
                : { ...selPersonalizationPanelState, preset: "custom" };
            // 预设结果立即作用于页面。
            selPersonalizationApplyPanel();
        });
        // 背景恢复按钮调用背景模块自己的刷新默认状态。
        selPersonalizationControl.querySelector("[data-sel-personal-action='reset-background']")?.addEventListener("click", () => {
            // 背景控制器恢复主题和三个显示参数。
            selPersonalizationBackgroundController.reset();
            // 个性化界面同步默认背景。
            selPersonalizationSyncBackground();
        });
        // 面板恢复按钮重新使用本次挂载的刷新默认值。
        selPersonalizationControl.querySelector("[data-sel-personal-action='reset-panel']")?.addEventListener("click", () => {
            // 默认状态只来自代码配置，不读取本地缓存。
            selPersonalizationPanelState = { ...selPersonalizationDefaults, themeColor: selPersonalizationNormalizeColor(selPersonalizationDefaults.themeColor), reducedMotion: Boolean(selPersonalizationDefaults.reducedMotion) };
            // 默认面板令牌立即写回页面。
            selPersonalizationApplyPanel();
        });
        // 点击个性化控件之外时关闭浮层，控件内部滚动和拖动 range 保持打开。
        document.addEventListener("pointerdown", (selPersonalizationEvent) => {
            if (!selPersonalizationControl.contains(selPersonalizationEvent.target)) {
                selPersonalizationPanel.hidden = true;
                selPersonalizationTrigger.setAttribute("aria-expanded", "false");
            }
        });
        // Escape 从任一内部状态关闭个性化面板并把焦点交还入口。
        document.addEventListener("keydown", (selPersonalizationEvent) => {
            if (selPersonalizationEvent.key === "Escape" && !selPersonalizationPanel.hidden) {
                selPersonalizationPanel.hidden = true;
                selPersonalizationTrigger.setAttribute("aria-expanded", "false");
                selPersonalizationTrigger.focus();
            }
        });
        // 背景模块从其他公开入口变化时，组合界面同步状态。
        document.addEventListener("selPageBackground:change", selPersonalizationSyncBackground);

        // 公开控制器提供当前状态、视图切换和刷新默认动作。
        const selPersonalizationController = Object.freeze({
            // presets 供应用读取可用预设清单，不暴露可变对象。
            presets: selPersonalizationPresets,
            // getState 同时返回背景与面板的不可变快照。
            getState: () => Object.freeze({
                background: selPersonalizationBackgroundController.getState(),
                panel: Object.freeze({ ...selPersonalizationPanelState })
            }),
            selectView: selPersonalizationSelectView,
            reset() {
                // 完整重置同时恢复背景和面板刷新默认值。
                selPersonalizationBackgroundController.reset();
                selPersonalizationPanelState = { ...selPersonalizationDefaults, themeColor: selPersonalizationNormalizeColor(selPersonalizationDefaults.themeColor), reducedMotion: Boolean(selPersonalizationDefaults.reducedMotion) };
                selPersonalizationSyncBackground();
                selPersonalizationApplyPanel();
            }
        });
        // 保存控制器后立即同步背景与面板默认状态。
        selPersonalizationControllers.set(selPersonalizationHost, selPersonalizationController);
        selPersonalizationSyncBackground();
        selPersonalizationApplyPanel();
        // 返回组合控制器供应用确认挂载成功。
        return selPersonalizationController;
    }

    // 个性化模块只注册公开能力，不主动扫描页面。
    window.selPersonalization = Object.freeze({
        // presets 提供标准面板预设清单。
        presets: selPersonalizationPresets,
        // mount 是创建个性化设置 UI 的唯一入口。
        mount: selPersonalizationMount,
        // get 必须指定宿主，支持同页多实例隔离。
        get: (selPersonalizationHost) => selPersonalizationControllers.get(selPersonalizationHost) || null
    });
})();
