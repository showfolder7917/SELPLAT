/*
 * selPersonalization.js：SEL 页面个性化设置组合控件。
 * 负责“主题 / 背景 / 面板 / 文字 / 语言”五级界面、统一视觉令牌、动效、预设和当前页面实时预览。
 * 责任边界：公共文案与语言选项由调用方传入；项目业务数据仍由应用装配层按 locale 加载，本组件不识别 具体应用 目录。
 * 模块级 JavaScript 标识统一使用 selPersonalization 前缀，公开控制器为 window.sel.components.personalization。
 */
(function selPersonalizationInitialize() {
    "use strict";

    const selFreeze = window.sel.core.freeze;

    // 每个个性化宿主只创建一个控制器，避免重复绑定全局输入事件。
    const selPersonalizationControllers = new WeakMap();
    // 主题、模式、颜色和素材只能来自注册表；个性化控件不再保存水晶主题私有清单。
    const selPersonalizationThemeManager = window.sel.theme.manager;
    // 设置注册表承接未来后端 JSON；当前组件只消费已校验的模块描述，不自行拼接项目接口。
    const selPersonalizationSettingsRegistry = window.sel.components.personalizationRegistry;
    const selPersonalizationThemes = selPersonalizationThemeManager?.themes?.() || [];
    const selPersonalizationDefaultTheme = selPersonalizationThemes[0] || null;
    // 当前主题和模式数组可在运行时替换，新增主题无需修改本组件事件分支。
    let selPersonalizationActiveTheme = selPersonalizationThemeManager?.getTheme?.() || selPersonalizationDefaultTheme;
    let selPersonalizationSkins = selPersonalizationActiveTheme?.modes || [];
    let selPersonalizationDefaultSkin = selPersonalizationActiveTheme?.defaults?.mode || selPersonalizationSkins[0]?.id || "dark";
    // 面板默认值全部采用 0 至 100 的用户尺度，刷新页面时从这里重新开始。
    const selPersonalizationPanelDefaults = selFreeze({
        // accent 保存正式颜色组合 ID，themeColor 只保存任意自定义色；二者同时为空表示主题基础材质。
        themeAccent: null,
        themeColor: null,
        // 原始水晶边框默认完整显示；透明度只影响独立图片层，不影响内板、内容或发光。
        frameOpacity: 100,
        // 深色默认保留接近一半的玻璃底色，让背景可感知但不压过表格与树形内容。
        panelOpacity: 52,
        // 默认磨砂兼顾背景虚化和中端设备的实时响应。
        backgroundFrost: 44,
        themeTint: 60,
        panelRadius: 52,
        panelScale: 50,
        innerPanelFit: 100,
        frameWidth: 50,
        panelInset: 50,
        contentInset: 50,
        panelGap: 50,
        glowSpread: 44,
        controlGap: 50,
        windowMotion: 36,
        glowMotion: 22,
        reducedMotion: false,
        // 刷新页面固定回到可见的默认预设；用户手动调整仍只进入当前页面的临时 custom 状态。
        preset: "default"
    });
    // 文字默认只声明跟随模式；实际颜色由当前皮肤令牌在应用时解析，避免浅色皮肤继承深色白字。
    const selPersonalizationTextDefaults = selFreeze({
        mode: "follow",
        mainColor: null,
        mutedColor: null,
        contrast: 60,
        fontScale: 50,
        // 对比与字号分别记录用户是否主动覆盖，避免调整排版时把跟随皮肤的颜色误切成自定义。
        contrastOverride: false,
        fontScaleOverride: false
    });
    // 文字模式使用中性名称，并为深浅皮肤提供独立颜色与对比参数；custom 继续保留用户当前值。
    const selPersonalizationTextModes = selFreeze([
        { id: "follow", label: "跟随皮肤", icon: "ri-brush-line", values: {
            dark: { mainColor: null, mutedColor: null, contrast: 60, fontScale: 50 },
            light: { mainColor: null, mutedColor: null, contrast: 72, fontScale: 50 }
        } },
        { id: "soft", label: "柔和", icon: "ri-feather-line", values: {
            dark: { mainColor: "#DCE6FA", mutedColor: "#9BAAC4", contrast: 42, fontScale: 50 },
            light: { mainColor: "#33445E", mutedColor: "#728096", contrast: 46, fontScale: 50 }
        } },
        { id: "clear", label: "清晰", icon: "ri-focus-3-line", values: {
            dark: { mainColor: "#FFFFFF", mutedColor: "#C8D4EA", contrast: 78, fontScale: 52 },
            light: { mainColor: "#0B1633", mutedColor: "#44536B", contrast: 68, fontScale: 52 }
        } },
        { id: "custom", label: "自定义", icon: "ri-font-color", values: null }
    ]);
    // 每个预设分别保存深浅皮肤参数；稳定 ID 保持不变，显示名称改用不限定明暗的“沉浸”。
    const selPersonalizationPresets = selFreeze([
        { id: "deep-space", label: "沉浸", icon: "ri-focus-2-line", values: {
            dark: { frameOpacity: 100, panelOpacity: 80, backgroundFrost: 60, themeTint: 72, panelRadius: 46, panelScale: 50, innerPanelFit: 100, frameWidth: 54, panelInset: 48, contentInset: 52, panelGap: 50, glowSpread: 56, controlGap: 50, windowMotion: 34, glowMotion: 24, reducedMotion: false },
            light: { frameOpacity: 90, panelOpacity: 86, backgroundFrost: 58, themeTint: 28, panelRadius: 54, panelScale: 50, innerPanelFit: 100, frameWidth: 48, panelInset: 48, contentInset: 54, panelGap: 50, glowSpread: 32, controlGap: 52, windowMotion: 30, glowMotion: 16, reducedMotion: false }
        } },
        { id: "transparent", label: "通透", icon: "ri-contrast-drop-2-line", values: {
            dark: { frameOpacity: 82, panelOpacity: 30, backgroundFrost: 68, themeTint: 34, panelRadius: 62, panelScale: 50, innerPanelFit: 100, frameWidth: 46, panelInset: 44, contentInset: 54, panelGap: 56, glowSpread: 32, controlGap: 54, windowMotion: 30, glowMotion: 14, reducedMotion: false },
            light: { frameOpacity: 72, panelOpacity: 48, backgroundFrost: 68, themeTint: 10, panelRadius: 68, panelScale: 50, innerPanelFit: 100, frameWidth: 38, panelInset: 44, contentInset: 56, panelGap: 58, glowSpread: 16, controlGap: 56, windowMotion: 28, glowMotion: 8, reducedMotion: false }
        } },
        { id: "eye-care", label: "护眼", icon: "ri-eye-line", values: {
            dark: { frameOpacity: 72, panelOpacity: 74, backgroundFrost: 50, themeTint: 18, panelRadius: 60, panelScale: 50, innerPanelFit: 100, frameWidth: 44, panelInset: 52, contentInset: 60, panelGap: 60, glowSpread: 10, controlGap: 60, windowMotion: 10, glowMotion: 0, reducedMotion: true },
            light: { frameOpacity: 66, panelOpacity: 80, backgroundFrost: 56, themeTint: 6, panelRadius: 64, panelScale: 50, innerPanelFit: 100, frameWidth: 38, panelInset: 52, contentInset: 62, panelGap: 62, glowSpread: 6, controlGap: 62, windowMotion: 10, glowMotion: 0, reducedMotion: true }
        } },
        { id: "high-contrast", label: "高对比", icon: "ri-contrast-2-line", values: {
            dark: { frameOpacity: 100, panelOpacity: 94, backgroundFrost: 58, themeTint: 48, panelRadius: 38, panelScale: 50, innerPanelFit: 100, frameWidth: 62, panelInset: 46, contentInset: 56, panelGap: 50, glowSpread: 24, controlGap: 54, windowMotion: 18, glowMotion: 4, reducedMotion: false },
            light: { frameOpacity: 94, panelOpacity: 96, backgroundFrost: 62, themeTint: 14, panelRadius: 48, panelScale: 50, innerPanelFit: 100, frameWidth: 56, panelInset: 46, contentInset: 58, panelGap: 50, glowSpread: 18, controlGap: 54, windowMotion: 16, glowMotion: 4, reducedMotion: false }
        } },
        { id: "default", label: "默认", icon: "ri-equalizer-2-line", values: {
            dark: { frameOpacity: 100, panelOpacity: 52, backgroundFrost: 44, themeTint: 60, panelRadius: 52, panelScale: 50, innerPanelFit: 100, frameWidth: 50, panelInset: 50, contentInset: 50, panelGap: 50, glowSpread: 44, controlGap: 50, windowMotion: 36, glowMotion: 22, reducedMotion: false },
            light: { frameOpacity: 82, panelOpacity: 72, backgroundFrost: 52, themeTint: 18, panelRadius: 58, panelScale: 50, innerPanelFit: 100, frameWidth: 44, panelInset: 50, contentInset: 54, panelGap: 52, glowSpread: 24, controlGap: 52, windowMotion: 34, glowMotion: 14, reducedMotion: false }
        } }
    ]);
    // 面板 range 配置集中声明分组、标签和辅助说明，增删项目不需要复制事件分支。
    const selPersonalizationPanelRangeGroups = selFreeze([
        {
            id: "appearance",
            title: "外观",
            icon: "ri-palette-line",
            items: [
                { key: "frameOpacity", label: "边框透明度", hint: "仅调整原始水晶图片层" },
                { key: "panelOpacity", label: "面板透明度", hint: "同步玻璃底板与表格结构" },
                { key: "backgroundFrost", label: "背景磨砂", hint: "虚化面板后方内容" },
                { key: "themeTint", label: "主题染色", hint: "颜色跟随当前皮肤" },
                { key: "panelRadius", label: "面板圆角", hint: "贴合水晶边框切角" }
            ]
        },
        {
            id: "spacing",
            title: "边框与间距",
            icon: "ri-layout-grid-line",
            items: [
                { key: "frameWidth", label: "边框厚度", hint: "保持九宫格切角比例" },
                { key: "panelScale", label: "面板等比大小", hint: "宽高内容与边框同步缩放" },
                { key: "innerPanelFit", label: "边框/内板比例", hint: "四边同步贴近或远离外框", maximum: 150 },
                { key: "panelInset", label: "外框/内板间距", hint: "控制内板贴近水晶外框" },
                { key: "contentInset", label: "内容内边距", hint: "文字远离发光边带" },
                { key: "panelGap", label: "面板间距", hint: "控制区域之间留白" },
                { key: "glowSpread", label: "发光扩散", hint: "不改变边框颜色" },
                { key: "controlGap", label: "控件间距", hint: "调整表单与按钮疏密" }
            ]
        },
        {
            id: "motion",
            title: "动效",
            icon: "ri-sparkling-line",
            items: [
                { key: "windowMotion", label: "窗口动画", hint: "控制出现与状态过渡" },
                { key: "glowMotion", label: "光效流动", hint: "控制边框呼吸强度" }
            ]
        }
    ]);

    /**
     * 把个性化强度限制在当前控件声明的合法范围。
     * @param {unknown} selPersonalizationValue - range、预设或公开 API 输入，例如 "68"。
     * @param {number} selPersonalizationFallback - 无效输入采用的刷新默认值。
     * @param {number} selPersonalizationMaximum - 当前控件规则允许的上限，常规为 100，内板比例为 150。
     * @returns {number} 0 至当前上限的稳定整数，例如内板比例可返回 150。
     */
    function selPersonalizationClamp(selPersonalizationValue, selPersonalizationFallback, selPersonalizationMaximum = 100) {
        // 数字转换兼容原生 range 返回的字符串。
        const selPersonalizationNumber = Number(selPersonalizationValue);
        // 非有限输入直接回退当前字段默认值。
        if (!Number.isFinite(selPersonalizationNumber)) {
            return selPersonalizationFallback;
        }
        // 四舍五入后夹取到当前配置范围，未登记例外的控件继续严格封顶 100。
        return Math.min(selPersonalizationMaximum, Math.max(0, Math.round(selPersonalizationNumber)));
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
            .getPropertyValue("--sel-theme-color-rgb")
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
     * 根据浏览器公开的设备能力选择水晶材质性能档位。
     * @returns {"full"|"reduced"} 常规设备返回 full；四核、4GB、节省流量或慢更新设备返回 reduced。
     */
    function selPersonalizationResolvePerformanceMode() {
        // 浏览器未公开内存时保留 0，避免把未知设备误判为低性能。
        const selPersonalizationDeviceMemory = Number(navigator.deviceMemory || 0);
        // 硬件线程用于识别四核及以下设备；未公开时同样不单独触发降级。
        const selPersonalizationHardwareConcurrency = Number(navigator.hardwareConcurrency || 0);
        // 节省流量模式代表用户主动要求降低资源开销，应同步采用轻量水晶效果。
        const selPersonalizationSaveData = Boolean(navigator.connection?.saveData);
        // 慢更新媒体特征覆盖电子墨水或浏览器明确声明的低刷新环境。
        const selPersonalizationSlowUpdate = Boolean(window.matchMedia?.("(update: slow)").matches);
        // 任一可靠低性能信号命中时降低磨砂采样与光效更新频率，但不改变交互反馈。
        const selPersonalizationShouldReduce = selPersonalizationSaveData
            || selPersonalizationSlowUpdate
            || (selPersonalizationDeviceMemory > 0 && selPersonalizationDeviceMemory <= 4)
            || (selPersonalizationHardwareConcurrency > 0 && selPersonalizationHardwareConcurrency <= 4);
        // 返回稳定字符串供 CSS 根状态直接选择性能令牌。
        return selPersonalizationShouldReduce ? "reduced" : "full";
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
        if (!selPersonalizationBackgroundController?.themes || typeof selPersonalizationBackgroundController.setDisplay !== "function" || !selPersonalizationThemeManager || !selPersonalizationActiveTheme) {
            return null;
        }
        // 应用可把后端返回的完整设置 Schema 原样交给注册表；失败时保留当前安全配置。
        if (selPersonalizationOptions.settingsSchema) {
            selPersonalizationSettingsRegistry?.replaceFromJson(selPersonalizationOptions.settingsSchema);
        }
        // 公共组件国际化数据由应用装配层从 SEL 公共配置目录加载后传入，不读取任何项目业务目录。
        let selPersonalizationLocale = String(selPersonalizationOptions.locale?.current || "zh-CN");
        let selPersonalizationMessages = selPersonalizationOptions.messages || {};
        let selPersonalizationTextMap = selPersonalizationMessages.text || {};
        let selPersonalizationTemplates = selPersonalizationMessages.templates || {};
        let selPersonalizationLanguageOptions = Array.isArray(selPersonalizationMessages.languageOptions)
            ? selPersonalizationMessages.languageOptions
            : [];
        // 精确文本映射只处理公共组件自身文案；项目名称、表格列和业务状态不进入本组件。
        const selPersonalizationTranslate = (selPersonalizationValue) => {
            const selPersonalizationSource = String(selPersonalizationValue);
            if (selPersonalizationTextMap[selPersonalizationSource]) return selPersonalizationTextMap[selPersonalizationSource];
            // 背景包可用“模式 · 配色”组合公共标签；逐段翻译可避免每个主题重复登记笛卡尔积文案。
            if (selPersonalizationSource.includes(" · ")) {
                return selPersonalizationSource.split(" · ").map((selPersonalizationPart) => selPersonalizationTextMap[selPersonalizationPart] || selPersonalizationPart).join(" · ");
            }
            return selPersonalizationSource;
        };
        // 模板占位符使用中性字段名，日中英语序由各自公共配置完整控制。
        const selPersonalizationFormat = (selPersonalizationTemplateKey, selPersonalizationValues, selPersonalizationFallback) => {
            const selPersonalizationTemplate = selPersonalizationTemplates[selPersonalizationTemplateKey] || selPersonalizationFallback;
            return Object.entries(selPersonalizationValues).reduce(
                (selPersonalizationResult, [selPersonalizationKey, selPersonalizationValue]) => selPersonalizationResult.replaceAll(`{${selPersonalizationKey}}`, String(selPersonalizationValue)),
                selPersonalizationTemplate
            );
        };
        // 已生成的公共节点按精确映射本地化，避免把业务数据中的同形文字误当作组件属性翻译。
        function selPersonalizationLocalizeNode(selPersonalizationNode, selPersonalizationPreviousTextMap = {}) {
            if (!(selPersonalizationNode instanceof Element)) return;
            const selPersonalizationPreviousValues = new Map(Object.entries(selPersonalizationPreviousTextMap).map(([selPersonalizationSource, selPersonalizationTranslated]) => [String(selPersonalizationTranslated), selPersonalizationSource]));
            const selPersonalizationWalker = document.createTreeWalker(selPersonalizationNode, NodeFilter.SHOW_TEXT);
            let selPersonalizationTextNode = selPersonalizationWalker.nextNode();
            while (selPersonalizationTextNode) {
                const selPersonalizationOriginal = selPersonalizationTextNode.nodeValue || "";
                const selPersonalizationTrimmed = selPersonalizationOriginal.trim();
                const selPersonalizationSource = selPersonalizationPreviousValues.get(selPersonalizationTrimmed) || selPersonalizationTrimmed;
                const selPersonalizationTranslated = selPersonalizationTextMap[selPersonalizationSource] || selPersonalizationSource;
                if (selPersonalizationTranslated && selPersonalizationTranslated !== selPersonalizationTrimmed) {
                    selPersonalizationTextNode.nodeValue = selPersonalizationOriginal.replace(selPersonalizationTrimmed, selPersonalizationTranslated);
                }
                selPersonalizationTextNode = selPersonalizationWalker.nextNode();
            }
            selPersonalizationNode.querySelectorAll("[aria-label], [title], [placeholder]").forEach((selPersonalizationElement) => {
                ["aria-label", "title", "placeholder"].forEach((selPersonalizationAttribute) => {
                    const selPersonalizationOriginal = selPersonalizationElement.getAttribute(selPersonalizationAttribute);
                    const selPersonalizationSource = selPersonalizationPreviousValues.get(selPersonalizationOriginal) || selPersonalizationOriginal;
                    if (selPersonalizationOriginal && selPersonalizationTextMap[selPersonalizationSource]) {
                        selPersonalizationElement.setAttribute(selPersonalizationAttribute, selPersonalizationTextMap[selPersonalizationSource]);
                    }
                });
            });
        }
        // 页面根节点承载跨组件共享的视觉令牌。
        const selPersonalizationDocumentRoot = document.documentElement;
        // 当前主题和模式从统一管理器读取，避免根属性、素材和设置面板各保存一份状态。
        let selPersonalizationThemeState = selPersonalizationThemeManager.getState().theme;
        let selPersonalizationSkinState = selPersonalizationSkins.some((selPersonalizationSkin) => selPersonalizationSkin.id === selPersonalizationThemeManager.getState().mode)
            ? selPersonalizationThemeManager.getState().mode
            : selPersonalizationDefaultSkin;
        // 最近使用只存在当前页面内存，长期保存将来由 USER 作用域接口接管。
        let selPersonalizationRecentThemeIds = [selPersonalizationThemeState, ...selPersonalizationThemes.map((selPersonalizationTheme) => selPersonalizationTheme.id)]
            .filter((selPersonalizationThemeId, selPersonalizationThemeIndex, selPersonalizationThemeIds) => selPersonalizationThemeIds.indexOf(selPersonalizationThemeId) === selPersonalizationThemeIndex)
            .slice(0, 4);
        // 性能档位只保存在当前页面根状态，刷新时会根据当前设备重新评估。
        selPersonalizationDocumentRoot.dataset.selPersonalPerformance = selPersonalizationResolvePerformanceMode();
        // 调用方覆盖只作为两套皮肤默认值的共同增量；未覆盖字段始终读取当前皮肤的 default 预设。
        const selPersonalizationDefaultOverrides = selFreeze({ ...(selPersonalizationOptions.defaults || {}) });
        const selPersonalizationResolveDefaults = (selPersonalizationSkinId) => ({
            ...selPersonalizationPanelDefaults,
            ...selPersonalizationPresets.find((selPersonalizationPreset) => selPersonalizationPreset.id === "default").values[selPersonalizationSkinId],
            ...selPersonalizationDefaultOverrides,
            preset: "default"
        });
        // 当前默认值会随皮肤切换，恢复按钮因此不会把浅色参数重置成深色参数。
        let selPersonalizationDefaults = selPersonalizationResolveDefaults(selPersonalizationSkinState);
        // 当前面板状态只保存在内存中，刷新页面自动重新使用默认值。
        let selPersonalizationPanelState = {
            ...selPersonalizationDefaults,
            themeAccent: selPersonalizationThemeManager.getState().accent,
            // 调用方默认色也必须通过统一校验；null 继续表示跟随皮肤。
            themeColor: selPersonalizationNormalizeColor(selPersonalizationDefaults.themeColor),
            reducedMotion: Boolean(selPersonalizationDefaults.reducedMotion)
        };
        // 文字状态仅存在于当前页面内存，不写 localStorage、cookie 或服务端配置。
        let selPersonalizationTextState = { ...selPersonalizationTextDefaults };
        // 通用浮动面板负责入口、外壳、标题、关闭和交互隔离；本组件提供五个公共设置视图。
        const selPersonalizationFloatingPanel = window.sel.components.floatingPanel?.mount(selPersonalizationHost, {
            id: "personalization",
            title: selPersonalizationTranslate("个性化设置"),
            subtitle: selPersonalizationTranslate("当前页面实时预览"),
            label: selPersonalizationTranslate("个性化设置"),
            triggerIcon: "ri-equalizer-2-line",
            icon: "ri-magic-line",
            openLabel: selPersonalizationTranslate("打开个性化设置"),
            closeLabel: selPersonalizationTranslate("关闭个性化设置"),
            // 个性化面板显式启用公共浮层缩放；右侧锚点固定，从左边和底边改变可用空间。
            resizable: {
                minWidth: 420,
                minHeight: 420,
                maxWidth: 960,
                labels: {
                    left: selPersonalizationTranslate("调整面板宽度"),
                    bottom: selPersonalizationTranslate("调整面板高度"),
                    corner: selPersonalizationTranslate("同时调整面板宽度和高度")
                },
                resetLabel: selPersonalizationTranslate("双击恢复面板默认大小")
            },
            // 兼容类只保留个性化面板的尺寸和皮肤细节，基础结构与行为已经由 selFloatingPanel 承担。
            classes: {
                control: "selpersonal-control",
                trigger: "selpersonal-trigger",
                panel: "selpersonal-panel",
                heading: "selpersonal-heading",
                headingIcon: "selpersonal-heading-icon",
                headingCopy: "selpersonal-heading-copy",
                close: "selpersonal-close"
            },
            // 一级区域固定为外观、用户和页面编辑；具体属性在区域内部扩展，避免主题数量或业务字段挤满顶栏。
            contentHtml: `
                    <div class="selpersonal-areas" role="tablist" aria-label="设置中心分类">
                        <button class="selpersonal-area selpersonal-area-selected" type="button" role="tab" aria-selected="true" aria-controls="selpersonal-appearance-area" data-sel-personal-area="appearance"><i class="ri-palette-line" aria-hidden="true"></i><span>外观设置</span></button>
                        <button class="selpersonal-area" type="button" role="tab" aria-selected="false" aria-controls="selpersonal-user-area" data-sel-personal-area="user"><i class="ri-user-settings-line" aria-hidden="true"></i><span>用户设置</span></button>
                        <button class="selpersonal-area" type="button" role="tab" aria-selected="false" aria-controls="selpersonal-page-area" data-sel-personal-area="page"><i class="ri-layout-masonry-line" aria-hidden="true"></i><span>页面编辑</span></button>
                    </div>
                    <section class="selpersonal-area-panel" id="selpersonal-appearance-area" data-sel-personal-area-panel="appearance">
                    <div class="selpersonal-tabs" role="tablist" aria-label="外观设置分类">
                        <button class="selpersonal-tab selpersonal-tab-selected" type="button" role="tab" aria-selected="true" aria-controls="selpersonal-skin-view" data-sel-personal-tab="skin"><i class="ri-contrast-2-line" aria-hidden="true"></i><span>主题</span></button>
                        <button class="selpersonal-tab" type="button" role="tab" aria-selected="false" aria-controls="selpersonal-background-view" data-sel-personal-tab="background"><i class="ri-landscape-line" aria-hidden="true"></i><span>背景</span></button>
                        <button class="selpersonal-tab" type="button" role="tab" aria-selected="false" aria-controls="selpersonal-panel-view" data-sel-personal-tab="panel"><i class="ri-layout-4-line" aria-hidden="true"></i><span>面板</span></button>
                        <button class="selpersonal-tab" type="button" role="tab" aria-selected="false" aria-controls="selpersonal-text-view" data-sel-personal-tab="text"><i class="ri-font-size-2" aria-hidden="true"></i><span>文字</span></button>
                    </div>
                    <div class="selpersonal-view" id="selpersonal-skin-view" role="tabpanel" data-sel-personal-view="skin">
                        <div class="selpersonal-theme-home" data-sel-personal-theme-home>
                        <section class="selpersonal-current-theme" aria-labelledby="selpersonal-current-theme-title">
                            <header class="selpersonal-view-heading"><strong id="selpersonal-current-theme-title">当前主题</strong><button type="button" data-sel-personal-theme-library-toggle aria-expanded="false"><i class="ri-store-2-line" aria-hidden="true"></i><span>更换主题</span><i class="ri-arrow-right-s-line" aria-hidden="true"></i></button></header>
                            <div data-sel-personal-current-theme></div>
                        </section>
                        <section class="selpersonal-recent-theme-section" aria-labelledby="selpersonal-recent-theme-title">
                            <header class="selpersonal-view-heading"><strong id="selpersonal-recent-theme-title">最近使用</strong><span>最多显示 4 个</span></header>
                            <div class="selpersonal-recent-themes" data-sel-personal-recent-themes role="group" aria-label="最近使用的主题"></div>
                        </section>
                        <header class="selpersonal-view-heading"><strong>选择界面明暗</strong><span>保留当前主题配色</span></header>
                        <div class="selpersonal-skin-grid" data-sel-personal-skin-grid role="group" aria-label="界面明暗"></div>
                        <section class="selpersonal-skin-theme-section" data-sel-personal-skin-themes aria-labelledby="selpersonal-skin-theme-title">
                            <header class="selpersonal-section-heading"><span><i class="ri-palette-line" aria-hidden="true"></i><strong id="selpersonal-skin-theme-title">主题皮肤</strong></span><small>${selPersonalizationFormat("activeVariantCount", { count: 7 }, "当前模式 {count} 套")}</small></header>
                            <div class="selpersonal-skin-theme-rows" data-sel-personal-skin-theme-rows></div>
                            <div class="selpersonal-color-heading selpersonal-skin-custom-color">
                                <span class="selpersonal-panel-range-copy"><strong>自定义主题色</strong><small>仅改变统一颜色令牌</small></span>
                                <label class="selpersonal-color-picker"><input type="color" data-sel-personal-theme-color aria-label="选择统一主题色"><output data-sel-personal-theme-color-output></output></label>
                            </div>
                            <button class="selpersonal-color-follow" type="button" data-sel-personal-theme-follow aria-pressed="true"><i class="ri-brush-line" aria-hidden="true"></i><span>跟随当前皮肤</span></button>
                        </section>
                        <p class="selpersonal-skin-note"><i class="ri-information-line" aria-hidden="true"></i><span>选择主题会同步深浅皮肤、专属边框与配套背景；两张基础皮肤卡保持固定预览色。</span></p>
                        <button class="selpersonal-reset" type="button" data-sel-personal-action="reset-skin"><i class="ri-restart-line" aria-hidden="true"></i><span>恢复默认主题</span></button>
                        </div>
                        <section class="selpersonal-theme-library" data-sel-personal-theme-library hidden aria-labelledby="selpersonal-theme-library-title">
                            <header class="selpersonal-theme-library-heading">
                                <button type="button" data-sel-personal-theme-library-back aria-label="返回主题设置"><i class="ri-arrow-left-line" aria-hidden="true"></i><span>返回</span></button>
                                <span class="selpersonal-theme-library-heading-copy"><strong id="selpersonal-theme-library-title">主题库</strong><small>按名称或分类查找</small></span>
                                <output data-sel-personal-theme-library-count></output>
                            </header>
                            <div class="selpersonal-theme-library-tools">
                                <label><i class="ri-search-line" aria-hidden="true"></i><input type="search" data-sel-personal-theme-search placeholder="搜索主题"></label>
                                <div class="seldropdown-root seldropdown-surface-compact selpersonal-theme-category" data-sel-dropdown-menu data-sel-personal-theme-category-root>
                                    <select class="seldropdown-native" data-sel-personal-theme-category aria-label="主题分类"></select>
                                </div>
                            </div>
                            <div class="selpersonal-theme-library-grid" data-sel-personal-theme-grid role="group" aria-label="主题库"></div>
                            <p class="selpersonal-theme-library-empty" data-sel-personal-theme-empty hidden>没有匹配的主题</p>
                        </section>
                    </div>
                    <div class="selpersonal-view" id="selpersonal-background-view" role="tabpanel" data-sel-personal-view="background" hidden>
                        <header class="selpersonal-view-heading"><strong>选择网页背景</strong><span>${selPersonalizationFormat("backgroundCount", { count: selPersonalizationBackgroundController.themes.length }, "{count} 种独立主题")}</span></header>
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
                    <div class="selpersonal-view" id="selpersonal-text-view" role="tabpanel" data-sel-personal-view="text" hidden>
                        <header class="selpersonal-view-heading"><strong>文字个性化</strong><span>统一作用于页面组件</span></header>
                        <div class="selpersonal-text-scroll" data-sel-personal-text-scroll>
                            <section class="selpersonal-section selpersonal-text-section">
                                <header class="selpersonal-section-heading"><span><i class="ri-font-size" aria-hidden="true"></i><strong>文字模式</strong></span><small>刷新恢复默认</small></header>
                                <div class="selpersonal-text-modes" data-sel-personal-text-modes role="group" aria-label="文字模式"></div>
                                <div class="selpersonal-text-preview" aria-label="文字效果预览"><strong>主文字预览</strong><span>次级说明与辅助信息预览</span></div>
                            </section>
                            <section class="selpersonal-section selpersonal-text-section">
                                <header class="selpersonal-section-heading"><span><i class="ri-palette-line" aria-hidden="true"></i><strong>颜色与可读性</strong></span></header>
                                <label class="selpersonal-text-color"><span><strong>主文字颜色</strong><small>标题、正文与主要控件</small></span><input type="color" data-sel-personal-text-color="mainColor" aria-label="选择主文字颜色"><output data-sel-personal-text-color-output="mainColor"></output></label>
                                <label class="selpersonal-text-color"><span><strong>次级文字颜色</strong><small>说明、占位符与辅助信息</small></span><input type="color" data-sel-personal-text-color="mutedColor" aria-label="选择次级文字颜色"><output data-sel-personal-text-color-output="mutedColor"></output></label>
                                <label class="selpersonal-panel-range"><span class="selpersonal-panel-range-copy"><strong>文字对比</strong><small>增强复杂背景上的清晰度</small></span><span class="selpersonal-panel-range-control"><input type="range" min="0" max="100" step="1" data-sel-personal-text-range="contrast"><output data-sel-personal-text-output="contrast"></output></span></label>
                                <label class="selpersonal-panel-range"><span class="selpersonal-panel-range-copy"><strong>字号缩放</strong><small>统一映射为 80%–120%</small></span><span class="selpersonal-panel-range-control"><input type="range" min="0" max="100" step="1" data-sel-personal-text-range="fontScale"><output data-sel-personal-text-output="fontScale"></output></span></label>
                            </section>
                        </div>
                        <button class="selpersonal-reset" type="button" data-sel-personal-action="reset-text"><i class="ri-restart-line" aria-hidden="true"></i><span>恢复文字默认</span></button>
                    </div>
                    </section>
                    <section class="selpersonal-area-panel" id="selpersonal-user-area" data-sel-personal-area-panel="user" hidden>
                        <div class="selpersonal-tabs" role="tablist" aria-label="用户设置分类">
                            <button class="selpersonal-tab selpersonal-tab-selected" type="button" role="tab" aria-selected="true" aria-controls="selpersonal-language-view" data-sel-personal-tab="language"><i class="ri-translate-2" aria-hidden="true"></i><span>语言</span></button>
                        </div>
                        <div class="selpersonal-view" id="selpersonal-language-view" role="tabpanel" data-sel-personal-view="language">
                            <header class="selpersonal-view-heading"><strong>选择界面语言</strong><span>公共界面与当前项目配置分别加载</span></header>
                            <div class="selpersonal-language-grid" data-sel-personal-language-grid role="group" aria-label="界面语言"></div>
                            <div class="selpersonal-extension-modules" data-sel-personal-extension-area="user"></div>
                            <p class="selpersonal-skin-note"><i class="ri-information-line" aria-hidden="true"></i><span>切换语言后会保留当前页面参数并重新加载对应项目配置。</span></p>
                        </div>
                    </section>
                    <section class="selpersonal-area-panel" id="selpersonal-page-area" data-sel-personal-area-panel="page" hidden>
                        <div class="selpersonal-page-editor-heading"><span><i class="ri-layout-masonry-line" aria-hidden="true"></i><strong>页面编辑</strong></span><small>仅管理员可操作</small></div>
                        <label class="selpersonal-page-edit-switch">
                            <span><i class="ri-edit-box-line" aria-hidden="true"></i><strong>手动编辑页面</strong><small data-sel-personal-page-edit-status>已关闭</small></span>
                            <input type="checkbox" role="switch" data-sel-personal-page-edit-switch aria-label="开启整页手动编辑" aria-checked="false">
                            <i aria-hidden="true"></i>
                        </label>
                    </section>`
        });
        // 缺少通用浮动面板注册能力时拒绝创建半套个性化界面。
        if (!selPersonalizationFloatingPanel) return null;
        // 固定节点直接使用基础控制器返回值，后续状态同步不再了解外壳内部实现。
        const selPersonalizationControl = selPersonalizationFloatingPanel.root;
        const selPersonalizationTrigger = selPersonalizationFloatingPanel.trigger;
        const selPersonalizationPanel = selPersonalizationFloatingPanel.panel;
        const selPersonalizationThemeGrid = selPersonalizationHost.querySelector("[data-sel-personal-theme-grid]");
        const selPersonalizationThemeHome = selPersonalizationHost.querySelector("[data-sel-personal-theme-home]");
        const selPersonalizationCurrentTheme = selPersonalizationHost.querySelector("[data-sel-personal-current-theme]");
        const selPersonalizationRecentThemes = selPersonalizationHost.querySelector("[data-sel-personal-recent-themes]");
        const selPersonalizationThemeLibrary = selPersonalizationHost.querySelector("[data-sel-personal-theme-library]");
        const selPersonalizationThemeLibraryToggle = selPersonalizationHost.querySelector("[data-sel-personal-theme-library-toggle]");
        const selPersonalizationThemeLibraryBack = selPersonalizationHost.querySelector("[data-sel-personal-theme-library-back]");
        const selPersonalizationThemeSearch = selPersonalizationHost.querySelector("[data-sel-personal-theme-search]");
        const selPersonalizationThemeCategoryRoot = selPersonalizationHost.querySelector("[data-sel-personal-theme-category-root]");
        const selPersonalizationThemeCategory = selPersonalizationHost.querySelector("[data-sel-personal-theme-category]");
        const selPersonalizationThemeLibraryCount = selPersonalizationHost.querySelector("[data-sel-personal-theme-library-count]");
        const selPersonalizationThemeEmpty = selPersonalizationHost.querySelector("[data-sel-personal-theme-empty]");
        const selPersonalizationSkinGrid = selPersonalizationHost.querySelector("[data-sel-personal-skin-grid]");
        const selPersonalizationSkinThemeRows = selPersonalizationHost.querySelector("[data-sel-personal-skin-theme-rows]");
        const selPersonalizationBackgroundGrid = selPersonalizationHost.querySelector("[data-sel-personal-background-grid]");
        const selPersonalizationPanelScroll = selPersonalizationHost.querySelector("[data-sel-personal-panel-scroll]");
        const selPersonalizationTextScroll = selPersonalizationHost.querySelector("[data-sel-personal-text-scroll]");
        const selPersonalizationTextModeGrid = selPersonalizationHost.querySelector("[data-sel-personal-text-modes]");
        const selPersonalizationPresetGrid = selPersonalizationHost.querySelector("[data-sel-personal-presets]");
        const selPersonalizationLanguageGrid = selPersonalizationHost.querySelector("[data-sel-personal-language-grid]");
        // 任一关键节点缺失都阻止创建不可完整操作的控制器。
        if (!selPersonalizationControl || !selPersonalizationTrigger || !selPersonalizationPanel || !selPersonalizationThemeGrid || !selPersonalizationThemeHome || !selPersonalizationCurrentTheme || !selPersonalizationRecentThemes || !selPersonalizationThemeLibrary || !selPersonalizationThemeLibraryToggle || !selPersonalizationThemeLibraryBack || !selPersonalizationThemeSearch || !selPersonalizationThemeCategoryRoot || !selPersonalizationThemeCategory || !selPersonalizationThemeLibraryCount || !selPersonalizationThemeEmpty || !selPersonalizationSkinGrid || !selPersonalizationSkinThemeRows || !selPersonalizationBackgroundGrid || !selPersonalizationPanelScroll || !selPersonalizationTextScroll || !selPersonalizationTextModeGrid || !selPersonalizationPresetGrid || !selPersonalizationLanguageGrid) {
            return null;
        }
        // 分类选择器延迟到首次选项生成后挂载；后续主题或语言重绘复用同一公共下拉实例。
        let selPersonalizationThemeCategoryDropdown = null;

        // 语言卡只消费公共个性化配置，稳定 locale 值由应用回调决定加载哪个项目目录。
        function selPersonalizationRenderLanguageOptions() {
            selPersonalizationLanguageGrid.replaceChildren();
            selPersonalizationLanguageOptions.forEach((selPersonalizationLanguage) => {
                const selPersonalizationLanguageButton = document.createElement("button");
                selPersonalizationLanguageButton.className = "selpersonal-language-option";
                selPersonalizationLanguageButton.type = "button";
                selPersonalizationLanguageButton.dataset.selPersonalLanguage = selPersonalizationLanguage.value;
                selPersonalizationLanguageButton.setAttribute("aria-pressed", String(selPersonalizationLanguage.value === selPersonalizationLocale));
                selPersonalizationLanguageButton.innerHTML = `<span class="selpersonal-language-icon" aria-hidden="true"><i class="ri-translate-2"></i></span><span><strong>${selPersonalizationLanguage.label}</strong><small>${selPersonalizationLanguage.description}</small></span><i class="ri-checkbox-circle-fill selpersonal-language-selected" aria-hidden="true"></i>`;
                selPersonalizationLanguageGrid.appendChild(selPersonalizationLanguageButton);
            });
        }
        selPersonalizationRenderLanguageOptions();

        /**
         * 根据项目 JSON 和前端已获授权结果绘制扩展模块摘要；具体编辑器以后按字段类型插入同一插槽。
         * @returns {void} 用户与页面区域都只消费注册表，不读取 具体应用 私有路径。
         */
        function selPersonalizationRenderExtensionModules() {
            ["user", "page"].forEach((selPersonalizationArea) => {
                const selPersonalizationModuleHost = selPersonalizationControl.querySelector(`[data-sel-personal-extension-area="${selPersonalizationArea}"]`);
                if (!selPersonalizationModuleHost) return;
                const selPersonalizationModules = selPersonalizationSettingsRegistry?.list({
                    area: selPersonalizationArea,
                    canAccess: (selPersonalizationPermission, selPersonalizationModule) => typeof selPersonalizationOptions.canAccessSetting === "function"
                        ? selPersonalizationOptions.canAccessSetting(selPersonalizationPermission, selPersonalizationModule)
                        : true
                }) || [];
                selPersonalizationModuleHost.replaceChildren();
                selPersonalizationModules.forEach((selPersonalizationModule) => {
                    const selPersonalizationModuleCard = document.createElement("article");
                    selPersonalizationModuleCard.className = "selpersonal-extension-module";
                    selPersonalizationModuleCard.dataset.selPersonalModule = selPersonalizationModule.id;
                    selPersonalizationModuleCard.innerHTML = `<i class="${selPersonalizationModule.icon}" aria-hidden="true"></i><span><strong>${selPersonalizationTranslate(selPersonalizationModule.titleKey)}</strong><small>${selPersonalizationTranslate(selPersonalizationModule.descriptionKey)}</small></span><em>${selPersonalizationTranslate(selPersonalizationModule.scope.toUpperCase())} · ${selPersonalizationModule.fields.length}</em>`;
                    selPersonalizationModuleHost.appendChild(selPersonalizationModuleCard);
                });
                const selPersonalizationEmpty = selPersonalizationControl.querySelector(`[data-sel-personal-extension-empty="${selPersonalizationArea}"]`);
                if (selPersonalizationEmpty) selPersonalizationEmpty.hidden = selPersonalizationModules.length > 0;
            });
        }
        selPersonalizationRenderExtensionModules();

        // 页面编辑权限只接受应用从后台取得的明确布尔结论；缺少配置时默认不可操作。
        const selPersonalizationPageEditorAllowed = selPersonalizationOptions.pageEditor?.canEdit === true;
        // 每个页面控件由应用显式登记根节点、数据库坐标和保存适配器，公共层不扫描业务 DOM。
        const selPersonalizationPageControls = new Map();
        // 同一组合控件可以共用一个保存入口，但保存请求仍只提交当前选中的单个子控件。
        const selPersonalizationSharedPageControlActions = new Map();
        // 流式组合控件按登记顺序共享横向游标，任一项调宽时后续项自动跟随。
        const selPersonalizationPageControlFlowGroups = new Map();
        let selPersonalizationPageMode = "preview";
        let selPersonalizationSelectedPageControlId = "";
        const selPersonalizationPageAreaButton = selPersonalizationControl.querySelector('[data-sel-personal-area="page"]');
        const selPersonalizationPageAreaPanel = selPersonalizationControl.querySelector('[data-sel-personal-area-panel="page"]');
        const selPersonalizationPageControlsHost = null;
        const selPersonalizationPageInspector = null;
        const selPersonalizationPageActions = null;
        const selPersonalizationPageEmpty = null;
        const selPersonalizationPageEditSwitch = selPersonalizationControl.querySelector("[data-sel-personal-page-edit-switch]");
        const selPersonalizationPageEditStatus = selPersonalizationControl.querySelector("[data-sel-personal-page-edit-status]");
        // 非管理员不显示页面编辑入口；后台保存接口仍会执行第二次权限校验。
        if (selPersonalizationPageAreaButton) selPersonalizationPageAreaButton.hidden = !selPersonalizationPageEditorAllowed;
        selPersonalizationControl.querySelector(".selpersonal-areas")?.classList.toggle("selpersonal-areas-page-hidden", !selPersonalizationPageEditorAllowed);
        if (selPersonalizationPageAreaPanel && !selPersonalizationPageEditorAllowed) selPersonalizationPageAreaPanel.hidden = true;

        /** 把页面控件当前状态复制为独立快照，保存适配器不能改写控件内部对象。 */
        function selPersonalizationClonePageState(selPersonalizationPageState) {
            return selPersonalizationPageState && typeof selPersonalizationPageState === "object"
                ? JSON.parse(JSON.stringify(selPersonalizationPageState))
                : {};
        }

        /** 在实际控件右上角同步编辑入口，预览模式保持业务页面干净。 */
        function selPersonalizationSyncPageControlBadges() {
            // 先发布模式再显示动作，让应用基于模式声明的公共布局变量在本绘制帧立即生效。
            document.documentElement.dataset.selPageEditMode = selPersonalizationPageMode;
            selPersonalizationPageControls.forEach((selPersonalizationPageControl) => {
                const selPersonalizationShowBadge = selPersonalizationPageMode === "edit" && selPersonalizationPageControl.enabled;
                selPersonalizationPageControl.roots.forEach((selPersonalizationRoot) => {
                    selPersonalizationRoot.classList.toggle("selpersonal-page-editable", selPersonalizationShowBadge);
                });
                if (selPersonalizationPageControl.geometry?.editFrame) {
                    selPersonalizationPageControl.geometry.editFrame.hidden = !selPersonalizationShowBadge;
                }
                selPersonalizationPageControl.editButtons.forEach((selPersonalizationEditButton) => { selPersonalizationEditButton.hidden = !selPersonalizationShowBadge; });
                selPersonalizationPageControl.geometryButtons.forEach((selPersonalizationGeometryButton) => { selPersonalizationGeometryButton.hidden = !selPersonalizationShowBadge; });
            });
            selPersonalizationSyncSharedPageControlActions();
            // 模式切换可能改变工具栏内边距；下一帧按数据库坐标重算基线，避免只开编辑就让保存坐标漂移。
            window.requestAnimationFrame(() => {
                selPersonalizationPageControls.forEach((selPersonalizationPageControl) => {
                    if (!selPersonalizationPageControl.geometry) return;
                    selPersonalizationApplyPageControlGeometry(selPersonalizationPageControl, {
                        x: selPersonalizationPageControl.geometry.x,
                        y: selPersonalizationPageControl.geometry.y,
                        width: selPersonalizationPageControl.root.style.width,
                        height: selPersonalizationPageControl.root.style.height
                    });
                });
            });
        }

        /** 同步组合控件的唯一保存入口，并用稳定 Code 标识当前实际保存目标。 */
        function selPersonalizationSyncSharedPageControlActions() {
            selPersonalizationSharedPageControlActions.forEach((selPersonalizationSharedAction) => {
                const selPersonalizationSelectedControl = selPersonalizationPageControls.get(selPersonalizationSelectedPageControlId);
                const selPersonalizationTargetControl = selPersonalizationSharedAction.controlIds.has(selPersonalizationSelectedControl?.id)
                    ? selPersonalizationSelectedControl
                    : Array.from(selPersonalizationSharedAction.controlIds)
                        .map((selPersonalizationControlId) => selPersonalizationPageControls.get(selPersonalizationControlId))
                        .find((selPersonalizationControl) => selPersonalizationControl?.enabled);
                const selPersonalizationShowAction = selPersonalizationPageMode === "edit" && Boolean(selPersonalizationTargetControl?.enabled);
                selPersonalizationSharedAction.button.hidden = !selPersonalizationShowAction;
                selPersonalizationSharedAction.button.disabled = Boolean(selPersonalizationTargetControl?.saving);
                selPersonalizationSharedAction.button.dataset.selPersonalPageControl = selPersonalizationTargetControl?.id || "";
                const selPersonalizationCode = selPersonalizationTargetControl?.coordinates
                    .find((selPersonalizationCoordinate) => selPersonalizationCoordinate.label.includes("Code"))?.value || "";
                const selPersonalizationActionLabel = `${selPersonalizationSharedAction.label}：${selPersonalizationTargetControl?.title || "未选择控件"}`;
                selPersonalizationSharedAction.button.querySelector("span").textContent = selPersonalizationSharedAction.label;
                selPersonalizationSharedAction.button.setAttribute("aria-label", selPersonalizationCode
                    ? `${selPersonalizationActionLabel}（${selPersonalizationCode}）` : selPersonalizationActionLabel);
                if (selPersonalizationShowAction && selPersonalizationSharedAction.followControlId) {
                    const selPersonalizationFollowControl = selPersonalizationPageControls.get(selPersonalizationSharedAction.followControlId);
                    if (selPersonalizationFollowControl) {
                        const selPersonalizationTargetRect = selPersonalizationFollowControl.root.getBoundingClientRect();
                        const selPersonalizationHost = selPersonalizationSharedAction.host;
                        const selPersonalizationOriginalTransition = selPersonalizationHost.style.transition;
                        selPersonalizationHost.style.transition = "none";
                        selPersonalizationHost.style.transform = "none";
                        const selPersonalizationHostBaseRect = selPersonalizationHost.getBoundingClientRect();
                        selPersonalizationHost.style.transform = `translate(${Math.round(selPersonalizationTargetRect.right + 8 - selPersonalizationHostBaseRect.left)}px, ${Math.round(selPersonalizationTargetRect.top - selPersonalizationHostBaseRect.top)}px)`;
                        void selPersonalizationHost.offsetWidth;
                        selPersonalizationHost.style.transition = selPersonalizationOriginalTransition;
                    }
                }
            });
        }

        /** 绘制当前控件的数据库坐标、修改状态和实时帮助。 */
        function selPersonalizationRenderPageInspector() {
            const selPersonalizationPageControl = selPersonalizationPageControls.get(selPersonalizationSelectedPageControlId);
            if (!selPersonalizationPageInspector || !selPersonalizationPageControl) {
                if (selPersonalizationPageInspector) selPersonalizationPageInspector.hidden = true;
                return;
            }
            selPersonalizationPageInspector.hidden = false;
            const selPersonalizationPageControlIcon = selPersonalizationPageInspector.querySelector("[data-sel-personal-page-control-icon]");
            const selPersonalizationPageControlTitle = selPersonalizationPageInspector.querySelector("[data-sel-personal-page-control-title]");
            const selPersonalizationPageDirty = selPersonalizationPageInspector.querySelector("[data-sel-personal-page-dirty]");
            const selPersonalizationPageCoordinates = selPersonalizationPageInspector.querySelector("[data-sel-personal-page-coordinates]");
            if (selPersonalizationPageControlIcon) selPersonalizationPageControlIcon.className = selPersonalizationPageControl.icon;
            if (selPersonalizationPageControlTitle) selPersonalizationPageControlTitle.textContent = selPersonalizationPageControl.title;
            if (selPersonalizationPageDirty) {
                selPersonalizationPageDirty.textContent = selPersonalizationPageControl.dirty ? "已修改" : "未修改";
                selPersonalizationPageDirty.classList.toggle("selpersonal-page-dirty", selPersonalizationPageControl.dirty);
            }
            if (selPersonalizationPageCoordinates) {
                selPersonalizationPageCoordinates.replaceChildren(...selPersonalizationPageControl.coordinates.map((selPersonalizationCoordinate) => {
                    const selPersonalizationCoordinateRow = document.createElement("div");
                    const selPersonalizationCoordinateLabel = document.createElement("dt");
                    const selPersonalizationCoordinateValue = document.createElement("dd");
                    selPersonalizationCoordinateLabel.textContent = selPersonalizationCoordinate.label;
                    selPersonalizationCoordinateValue.textContent = selPersonalizationCoordinate.value;
                    selPersonalizationCoordinateRow.append(selPersonalizationCoordinateLabel, selPersonalizationCoordinateValue);
                    return selPersonalizationCoordinateRow;
                }));
            }
        }

        /** 绘制当前页面已登记控件列表，并保持选中控件和页面内编辑按钮一致。 */
        function selPersonalizationRenderPageControls() {
            if (!selPersonalizationPageControlsHost) return;
            const selPersonalizationVisiblePageControls = Array.from(selPersonalizationPageControls.values())
                .filter((selPersonalizationPageControl) => selPersonalizationPageControl.enabled);
            const selPersonalizationPageControlButtons = selPersonalizationVisiblePageControls.map((selPersonalizationPageControl) => {
                const selPersonalizationPageControlButton = document.createElement("button");
                selPersonalizationPageControlButton.type = "button";
                selPersonalizationPageControlButton.dataset.selPersonalPageControl = selPersonalizationPageControl.id;
                selPersonalizationPageControlButton.className = selPersonalizationPageControl.id === selPersonalizationSelectedPageControlId
                    ? "selpersonal-page-control-selected" : "";
                const selPersonalizationPageControlIcon = document.createElement("i");
                selPersonalizationPageControlIcon.className = selPersonalizationPageControl.icon;
                selPersonalizationPageControlIcon.setAttribute("aria-hidden", "true");
                const selPersonalizationPageControlCopy = document.createElement("span");
                const selPersonalizationPageControlTitle = document.createElement("strong");
                const selPersonalizationPageControlType = document.createElement("small");
                selPersonalizationPageControlTitle.textContent = selPersonalizationPageControl.title;
                selPersonalizationPageControlType.textContent = selPersonalizationPageControl.typeLabel;
                selPersonalizationPageControlCopy.append(selPersonalizationPageControlTitle, selPersonalizationPageControlType);
                selPersonalizationPageControlButton.append(selPersonalizationPageControlIcon, selPersonalizationPageControlCopy);
                return selPersonalizationPageControlButton;
            });
            selPersonalizationPageControlsHost.replaceChildren(...selPersonalizationPageControlButtons);
            if (selPersonalizationPageEmpty) selPersonalizationPageEmpty.hidden = selPersonalizationVisiblePageControls.length > 0;
            if (selPersonalizationPageActions) selPersonalizationPageActions.hidden = selPersonalizationPageMode !== "edit"
                || !selPersonalizationVisiblePageControls.some((selPersonalizationPageControl) => !selPersonalizationPageControl.actionOnly);
            selPersonalizationRenderPageInspector();
        }

        /** 选中一个页面控件并把个性化浮层切到对应数据库坐标。 */
        function selPersonalizationSelectPageControl(selPersonalizationPageControlId) {
            if (!selPersonalizationPageControls.has(selPersonalizationPageControlId)) return false;
            selPersonalizationSelectedPageControlId = selPersonalizationPageControlId;
            selPersonalizationRenderPageControls();
            selPersonalizationSyncSharedPageControlActions();
            return true;
        }

        /** 页面编辑只负责开启或关闭整页手动编辑能力，不保存、恢复或拦截业务导航。 */
        async function selPersonalizationSetPageMode(selPersonalizationNextMode) {
            if (!selPersonalizationPageEditorAllowed || !["preview", "edit"].includes(selPersonalizationNextMode)) return false;
            if (selPersonalizationNextMode === selPersonalizationPageMode) return true;
            selPersonalizationPageMode = selPersonalizationNextMode;
            selPersonalizationSyncPageMode();
            return true;
        }

        /** 同步整页编辑开关、页面控件角标、检查器和保存动作状态。 */
        function selPersonalizationSyncPageMode() {
            const selPersonalizationEditing = selPersonalizationPageMode === "edit";
            if (selPersonalizationPageEditSwitch) {
                selPersonalizationPageEditSwitch.checked = selPersonalizationEditing;
                selPersonalizationPageEditSwitch.setAttribute("aria-checked", String(selPersonalizationEditing));
            }
            if (selPersonalizationPageEditStatus) selPersonalizationPageEditStatus.textContent = selPersonalizationEditing ? "已开启" : "已关闭";
            selPersonalizationSyncPageControlBadges();
            selPersonalizationRenderPageControls();
        }

        /** 让公共编辑边框始终覆盖真实控件矩形，按钮、输入框和下拉不再各自绘制黄框。 */
        function selPersonalizationSyncDirectGeometryFrame(selPersonalizationPageControl) {
            const selPersonalizationGeometry = selPersonalizationPageControl.geometry;
            const selPersonalizationEditFrame = selPersonalizationGeometry?.editFrame;
            if (!(selPersonalizationEditFrame instanceof Element)) return false;
            const selPersonalizationContainerRect = selPersonalizationGeometry.container.getBoundingClientRect();
            const selPersonalizationRootRect = selPersonalizationPageControl.root.getBoundingClientRect();
            const selPersonalizationFrameInset = 3;
            selPersonalizationEditFrame.style.left = `${Math.round(
                selPersonalizationRootRect.left - selPersonalizationContainerRect.left
                    + selPersonalizationGeometry.container.scrollLeft - selPersonalizationFrameInset
            )}px`;
            selPersonalizationEditFrame.style.top = `${Math.round(
                selPersonalizationRootRect.top - selPersonalizationContainerRect.top
                    + selPersonalizationGeometry.container.scrollTop - selPersonalizationFrameInset
            )}px`;
            selPersonalizationEditFrame.style.width = `${Math.round(selPersonalizationRootRect.width + selPersonalizationFrameInset * 2)}px`;
            selPersonalizationEditFrame.style.height = `${Math.round(selPersonalizationRootRect.height + selPersonalizationFrameInset * 2)}px`;
            return true;
        }

        /** 把页面控件几何状态夹在调用方声明的父容器边界内，并应用为独立宽高和位移。 */
        function selPersonalizationApplyPageControlGeometrySingle(selPersonalizationPageControl, selPersonalizationNextState = {}) {
            const selPersonalizationGeometry = selPersonalizationPageControl.geometry;
            if (!selPersonalizationGeometry) return false;
            const selPersonalizationRoot = selPersonalizationPageControl.root;
            const selPersonalizationContainerRect = selPersonalizationGeometry.container.getBoundingClientRect();
            const selPersonalizationRequestedWidth = Number.parseFloat(selPersonalizationNextState.width);
            const selPersonalizationRequestedHeight = Number.parseFloat(selPersonalizationNextState.height);
            const selPersonalizationWidth = Math.max(
                selPersonalizationGeometry.minWidth,
                Math.min(selPersonalizationGeometry.maxWidth, Number.isFinite(selPersonalizationRequestedWidth)
                    ? selPersonalizationRequestedWidth : selPersonalizationRoot.getBoundingClientRect().width)
            );
            const selPersonalizationHeight = Math.max(
                selPersonalizationGeometry.minHeight,
                Math.min(selPersonalizationGeometry.maxHeight, Number.isFinite(selPersonalizationRequestedHeight)
                    ? selPersonalizationRequestedHeight : selPersonalizationRoot.getBoundingClientRect().height)
            );
            // 显式几何控件由页面编辑器负责边界，解除父布局默认 max-width 才能真正独立调宽。
            selPersonalizationRoot.style.maxWidth = "none";
            selPersonalizationRoot.style.boxSizing = "border-box";
            selPersonalizationRoot.style.width = `${Math.round(selPersonalizationWidth)}px`;
            selPersonalizationRoot.style.height = `${Math.round(selPersonalizationHeight)}px`;
            // 每次先去掉旧位移取得稳定布局基线，避免 CSS transform 过渡中的中间矩形被重复累计。
            const selPersonalizationOriginalTransition = selPersonalizationRoot.style.transition;
            selPersonalizationRoot.style.transition = "none";
            selPersonalizationRoot.style.transform = "none";
            const selPersonalizationBaseRect = selPersonalizationRoot.getBoundingClientRect();
            const selPersonalizationBaseX = Math.round(selPersonalizationBaseRect.left - selPersonalizationContainerRect.left);
            const selPersonalizationBaseY = Math.round(selPersonalizationBaseRect.top - selPersonalizationContainerRect.top);
            const selPersonalizationRequestedX = Number(selPersonalizationNextState.x);
            const selPersonalizationRequestedY = Number(selPersonalizationNextState.y);
            const selPersonalizationX = Math.max(0, Math.min(
                Number.isFinite(selPersonalizationRequestedX) ? Math.round(selPersonalizationRequestedX) : selPersonalizationBaseX,
                Math.max(0, selPersonalizationContainerRect.width - selPersonalizationWidth)
            ));
            const selPersonalizationY = Math.max(0, Math.min(
                Number.isFinite(selPersonalizationRequestedY) ? Math.round(selPersonalizationRequestedY) : selPersonalizationBaseY,
                Math.max(0, selPersonalizationGeometry.boundsHeight - selPersonalizationHeight)
            ));
            selPersonalizationGeometry.x = selPersonalizationX;
            selPersonalizationGeometry.y = selPersonalizationY;
            selPersonalizationGeometry.width = selPersonalizationWidth;
            selPersonalizationGeometry.height = selPersonalizationHeight;
            selPersonalizationGeometry.translateX = selPersonalizationX - selPersonalizationBaseX;
            selPersonalizationGeometry.translateY = selPersonalizationY - selPersonalizationBaseY;
            selPersonalizationRoot.style.transform = `translate(${selPersonalizationGeometry.translateX}px, ${selPersonalizationGeometry.translateY}px)`;
            // 强制提交最终矩形后恢复调用方过渡，不让下一次测量读到动画中间态。
            void selPersonalizationRoot.offsetWidth;
            selPersonalizationRoot.style.transition = selPersonalizationOriginalTransition;
            selPersonalizationSyncDirectGeometryFrame(selPersonalizationPageControl);
            return true;
        }

        /** 按登记顺序重新排列一个流式组合；当前项宽度变化后，后续项在同一绘制帧自动让位。 */
        function selPersonalizationReflowPageControlGroup(selPersonalizationFlowKey) {
            const selPersonalizationFlowGroup = selPersonalizationPageControlFlowGroups.get(selPersonalizationFlowKey);
            if (!selPersonalizationFlowGroup) return false;
            let selPersonalizationNextX = null;
            const selPersonalizationFlowControls = selPersonalizationFlowGroup.controlIds
                .map((selPersonalizationControlId) => selPersonalizationPageControls.get(selPersonalizationControlId))
                .filter((selPersonalizationFlowControl) => selPersonalizationFlowControl?.geometry
                    && selPersonalizationFlowControl.enabled
                    && selPersonalizationFlowControl.root.isConnected)
                .sort((left, right) => left.geometry.flowOrder - right.geometry.flowOrder);
            // 横向查询组合共享第一项的纵向基线，数据库中的旧 y 不再让单个筛选控件上下错位。
            const selPersonalizationFlowY = selPersonalizationFlowControls[0]?.geometry.preferredY ?? 0;
            selPersonalizationFlowControls.forEach((selPersonalizationFlowControl) => {
                const selPersonalizationFlowGeometry = selPersonalizationFlowControl.geometry;
                const selPersonalizationFlowX = selPersonalizationNextX === null
                    ? selPersonalizationFlowGeometry.preferredX
                    : selPersonalizationNextX;
                selPersonalizationApplyPageControlGeometrySingle(selPersonalizationFlowControl, {
                    x: selPersonalizationFlowX,
                    y: selPersonalizationFlowY,
                    width: selPersonalizationFlowGeometry.width,
                    height: selPersonalizationFlowGeometry.height
                });
                selPersonalizationNextX = selPersonalizationFlowGeometry.x
                    + selPersonalizationFlowGeometry.width + selPersonalizationFlowGroup.gap;
                });
            selPersonalizationSyncSharedPageControlActions();
            return true;
        }

        /** 应用单控件几何；流式组合只更新当前项首选值，再统一重排全部同级控件。 */
        function selPersonalizationApplyPageControlGeometry(selPersonalizationPageControl, selPersonalizationNextState = {}) {
            const selPersonalizationGeometry = selPersonalizationPageControl.geometry;
            if (!selPersonalizationGeometry) return false;
            const selPersonalizationRequestedX = Number(selPersonalizationNextState.x);
            const selPersonalizationRequestedY = Number(selPersonalizationNextState.y);
            const selPersonalizationRequestedWidth = Number.parseFloat(selPersonalizationNextState.width);
            const selPersonalizationRequestedHeight = Number.parseFloat(selPersonalizationNextState.height);
            if (Number.isFinite(selPersonalizationRequestedX)) selPersonalizationGeometry.preferredX = selPersonalizationRequestedX;
            if (Number.isFinite(selPersonalizationRequestedY)) selPersonalizationGeometry.preferredY = selPersonalizationRequestedY;
            if (Number.isFinite(selPersonalizationRequestedWidth)) selPersonalizationGeometry.width = selPersonalizationRequestedWidth;
            if (Number.isFinite(selPersonalizationRequestedHeight)) selPersonalizationGeometry.height = selPersonalizationRequestedHeight;
            return selPersonalizationGeometry.flowKey
                ? selPersonalizationReflowPageControlGroup(selPersonalizationGeometry.flowKey)
                : selPersonalizationApplyPageControlGeometrySingle(selPersonalizationPageControl, selPersonalizationNextState);
        }

        /** 给公共页面控件动作按钮绑定移动或横向调宽，业务应用只提供父容器、范围和保存回调。 */
        function selPersonalizationBindPageControlGeometryAction(selPersonalizationPageControl, selPersonalizationButton, selPersonalizationAction) {
            let selPersonalizationPointerId = null;
            let selPersonalizationActiveAction = "move";
            let selPersonalizationStartClientX = 0;
            let selPersonalizationStartClientY = 0;
            let selPersonalizationStartState = null;
            let selPersonalizationPendingState = null;
            let selPersonalizationAnimationFrame = 0;
            const selPersonalizationApplyPendingState = () => {
                selPersonalizationAnimationFrame = 0;
                if (!selPersonalizationPendingState) return;
                selPersonalizationApplyPageControlGeometry(selPersonalizationPageControl, selPersonalizationPendingState);
                selPersonalizationPendingState = null;
            };
            const selPersonalizationHandlePointerMove = (selPersonalizationEvent) => {
                if (selPersonalizationPointerId === null || selPersonalizationEvent.pointerId !== selPersonalizationPointerId) return;
                const selPersonalizationDeltaX = selPersonalizationEvent.clientX - selPersonalizationStartClientX;
                const selPersonalizationDeltaY = selPersonalizationEvent.clientY - selPersonalizationStartClientY;
                selPersonalizationPendingState = selPersonalizationActiveAction === "move"
                    ? { ...selPersonalizationStartState, x: selPersonalizationStartState.x + selPersonalizationDeltaX, y: selPersonalizationStartState.y + selPersonalizationDeltaY }
                    : { ...selPersonalizationStartState, width: selPersonalizationStartState.width + selPersonalizationDeltaX };
                if (!selPersonalizationAnimationFrame) {
                    selPersonalizationAnimationFrame = window.requestAnimationFrame(selPersonalizationApplyPendingState);
                }
            };
            const selPersonalizationFinish = (selPersonalizationEvent) => {
                if (selPersonalizationPointerId === null || (selPersonalizationEvent?.pointerId !== undefined
                        && selPersonalizationEvent.pointerId !== selPersonalizationPointerId)) return;
                if (selPersonalizationAnimationFrame) window.cancelAnimationFrame(selPersonalizationAnimationFrame);
                selPersonalizationAnimationFrame = 0;
                selPersonalizationApplyPendingState();
                window.removeEventListener("pointermove", selPersonalizationHandlePointerMove);
                window.removeEventListener("pointerup", selPersonalizationFinish);
                window.removeEventListener("pointercancel", selPersonalizationFinish);
                window.removeEventListener("blur", selPersonalizationFinish);
                selPersonalizationPointerId = null;
                selPersonalizationButton.classList.remove("selpersonal-page-geometry-active");
                document.body.classList.remove("selpersonal-page-control-moving", "selpersonal-page-control-resizing");
            };
            selPersonalizationButton.addEventListener("pointerdown", (selPersonalizationEvent) => {
                if (selPersonalizationEvent.button !== 0 || selPersonalizationPageMode !== "edit" || !selPersonalizationPageControl.enabled) return;
                selPersonalizationEvent.preventDefault();
                selPersonalizationSelectPageControl(selPersonalizationPageControl.id);
                selPersonalizationActiveAction = typeof selPersonalizationAction === "function"
                    ? selPersonalizationAction(selPersonalizationEvent) : selPersonalizationAction;
                if (selPersonalizationActiveAction === "select") return;
                selPersonalizationPointerId = selPersonalizationEvent.pointerId;
                selPersonalizationStartClientX = selPersonalizationEvent.clientX;
                selPersonalizationStartClientY = selPersonalizationEvent.clientY;
                const selPersonalizationCurrent = selPersonalizationPageControl.captureState();
                selPersonalizationStartState = {
                    x: Number(selPersonalizationCurrent.x),
                    y: Number(selPersonalizationCurrent.y),
                    width: Number.parseFloat(selPersonalizationCurrent.width),
                    height: Number.parseFloat(selPersonalizationCurrent.height)
                };
                selPersonalizationButton.setPointerCapture?.(selPersonalizationPointerId);
                selPersonalizationButton.classList.add("selpersonal-page-geometry-active");
                document.body.classList.add(selPersonalizationActiveAction === "move"
                    ? "selpersonal-page-control-moving" : "selpersonal-page-control-resizing");
                window.addEventListener("pointermove", selPersonalizationHandlePointerMove);
                window.addEventListener("pointerup", selPersonalizationFinish);
                window.addEventListener("pointercancel", selPersonalizationFinish);
                window.addEventListener("blur", selPersonalizationFinish);
            });
            selPersonalizationButton.addEventListener("lostpointercapture", selPersonalizationFinish);
            if (selPersonalizationPageControl.geometry?.flowKey) {
                selPersonalizationButton.addEventListener("keydown", (selPersonalizationEvent) => {
                    if (selPersonalizationPageMode !== "edit" || !selPersonalizationEvent.altKey
                            || !["ArrowLeft", "ArrowRight"].includes(selPersonalizationEvent.key)) return;
                    selPersonalizationEvent.preventDefault();
                    selPersonalizationSelectPageControl(selPersonalizationPageControl.id);
                    const selPersonalizationCurrent = selPersonalizationPageControl.captureState();
                    selPersonalizationApplyPageControlGeometry(selPersonalizationPageControl, {
                        ...selPersonalizationCurrent,
                        width: Number.parseFloat(selPersonalizationCurrent.width)
                            + (selPersonalizationEvent.key === "ArrowRight" ? 8 : -8)
                    });
                });
            }
        }

        /** 显式保存一个页面控件；共享按钮与独立按钮使用同一条单控件保存链路。 */
        async function selPersonalizationSavePageControl(selPersonalizationPageControl) {
            if (!selPersonalizationPageControl || selPersonalizationPageControl.saving) return false;
            selPersonalizationSelectPageControl(selPersonalizationPageControl.id);
            if (selPersonalizationPageControl.actionOnly) {
                await selPersonalizationPageControl.onEdit();
                return true;
            }
            selPersonalizationPageControl.saving = true;
            selPersonalizationPageControl.editButtons.forEach((selPersonalizationButton) => { selPersonalizationButton.disabled = true; });
            selPersonalizationSyncSharedPageControlActions();
            try {
                await selPersonalizationPageControl.saveState(selPersonalizationClonePageState(selPersonalizationPageControl.captureState()));
                window.sel.core?.toast?.(`${selPersonalizationPageControl.typeLabel}设置已保存。`, "success");
                return true;
            } catch (selPersonalizationError) {
                window.sel.core?.toast?.(selPersonalizationError.message || `${selPersonalizationPageControl.typeLabel}保存失败。`, "error");
                return false;
            } finally {
                selPersonalizationPageControl.saving = false;
                selPersonalizationPageControl.editButtons.forEach((selPersonalizationButton) => { selPersonalizationButton.disabled = false; });
                selPersonalizationSyncSharedPageControlActions();
            }
        }

        /** 登记一个页面可编辑控件及其状态适配器；同 ID 只允许通过 updatePageControl 更新。 */
        function selPersonalizationRegisterPageControl(selPersonalizationDefinition = {}) {
            const selPersonalizationPageControlId = String(selPersonalizationDefinition.id || "").trim();
            const selPersonalizationPageControlActionOnly = typeof selPersonalizationDefinition.onEdit === "function";
            // 一个逻辑控件可以映射多个真实实例，例如同页多个 selWindow 标题栏共享同一数据库 Window 配置。
            const selPersonalizationRoots = Array.isArray(selPersonalizationDefinition.roots)
                ? selPersonalizationDefinition.roots.filter((selPersonalizationRoot) => selPersonalizationRoot instanceof Element)
                : (selPersonalizationDefinition.root instanceof Element ? [selPersonalizationDefinition.root] : []);
            const selPersonalizationEditHosts = Array.isArray(selPersonalizationDefinition.editHosts)
                ? selPersonalizationDefinition.editHosts.filter((selPersonalizationEditHost) => selPersonalizationEditHost instanceof Element)
                : (selPersonalizationDefinition.editHost instanceof Element ? [selPersonalizationDefinition.editHost] : [...selPersonalizationRoots]);
            if (!selPersonalizationPageEditorAllowed
                || !/^[a-z][a-z0-9]*$/i.test(selPersonalizationPageControlId)
                || selPersonalizationPageControls.has(selPersonalizationPageControlId)
                || selPersonalizationRoots.length === 0
                || selPersonalizationEditHosts.length === 0
                || (!selPersonalizationPageControlActionOnly && (
                    typeof selPersonalizationDefinition.captureState !== "function"
                    || typeof selPersonalizationDefinition.saveState !== "function"))) return false;
            const selPersonalizationPageControl = {
                id: selPersonalizationPageControlId,
                type: String(selPersonalizationDefinition.type || "control"),
                typeLabel: String(selPersonalizationDefinition.typeLabel || "页面控件"),
                title: String(selPersonalizationDefinition.title || "页面控件"),
                icon: String(selPersonalizationDefinition.icon || "ri-layout-masonry-line"),
                root: selPersonalizationRoots[0],
                roots: selPersonalizationRoots,
                editHosts: selPersonalizationEditHosts,
                coordinates: Array.isArray(selPersonalizationDefinition.coordinates) ? selPersonalizationDefinition.coordinates.map((selPersonalizationCoordinate) => ({
                    label: String(selPersonalizationCoordinate.label || "坐标"), value: String(selPersonalizationCoordinate.value || "—")
                })) : [],
                enabled: selPersonalizationDefinition.enabled !== false,
                actionOnly: selPersonalizationPageControlActionOnly,
                onEdit: selPersonalizationPageControlActionOnly ? selPersonalizationDefinition.onEdit : null,
                captureState: selPersonalizationDefinition.captureState || (() => ({})),
                saveState: selPersonalizationDefinition.saveState || (() => Promise.resolve(true)),
                editButtons: [], geometryButtons: [], saving: false,
                geometry: selPersonalizationDefinition.geometry?.container instanceof Element ? {
                    container: selPersonalizationDefinition.geometry.container,
                    direct: selPersonalizationDefinition.geometry.direct === true,
                    flowKey: String(selPersonalizationDefinition.geometry.flow?.key || "").trim(),
                    flowOrder: Number(selPersonalizationDefinition.geometry.flow?.order) || 0,
                    boundsHeight: Math.max(1, Number(selPersonalizationDefinition.geometry.boundsHeight) || 88),
                    minWidth: Math.max(1, Number(selPersonalizationDefinition.geometry.minWidth) || 48),
                    maxWidth: Math.max(1, Number(selPersonalizationDefinition.geometry.maxWidth) || 1200),
                    minHeight: Math.max(1, Number(selPersonalizationDefinition.geometry.minHeight) || 32),
                    maxHeight: Math.max(1, Number(selPersonalizationDefinition.geometry.maxHeight) || 200),
                    translateX: 0,
                    translateY: 0,
                    x: Number(selPersonalizationDefinition.geometry.state?.x) || 0,
                    y: Number(selPersonalizationDefinition.geometry.state?.y) || 0,
                    preferredX: Number(selPersonalizationDefinition.geometry.state?.x) || 0,
                    preferredY: Number(selPersonalizationDefinition.geometry.state?.y) || 0,
                    width: Number.parseFloat(selPersonalizationDefinition.geometry.state?.width) || selPersonalizationRoots[0].getBoundingClientRect().width,
                    height: Number.parseFloat(selPersonalizationDefinition.geometry.state?.height) || selPersonalizationRoots[0].getBoundingClientRect().height,
                    editFrame: null,
                    resizeHandle: null
                } : null
            };
            if (selPersonalizationPageControl.geometry) {
                window.requestAnimationFrame(() => selPersonalizationApplyPageControlGeometry(
                    selPersonalizationPageControl,
                    selPersonalizationDefinition.geometry.state || {}
                ));
            }
            const selPersonalizationHandleEdit = async () => {
                try {
                    await selPersonalizationSavePageControl(selPersonalizationPageControl);
                } catch (selPersonalizationError) {
                    console.error(`页面控件“${selPersonalizationPageControl.title}”编辑动作失败。`, selPersonalizationError);
                }
            };
            if (selPersonalizationPageControl.geometry?.direct) {
                selPersonalizationPageControl.root.classList.add("selpersonal-page-direct-geometry");
                selPersonalizationPageControl.geometry.container.classList.add("selpersonal-page-geometry-container");
                // 独立边框层不继承按钮、输入框或下拉的阴影和圆角，右边线本身就是可命中的真实手柄。
                const selPersonalizationEditFrame = document.createElement("span");
                selPersonalizationEditFrame.className = "selpersonal-page-direct-edit-frame";
                selPersonalizationEditFrame.hidden = true;
                selPersonalizationEditFrame.setAttribute("aria-hidden", "true");
                const selPersonalizationResizeHandle = document.createElement("span");
                selPersonalizationResizeHandle.className = "selpersonal-page-direct-resize-handle";
                selPersonalizationEditFrame.appendChild(selPersonalizationResizeHandle);
                selPersonalizationPageControl.geometry.container.appendChild(selPersonalizationEditFrame);
                selPersonalizationPageControl.geometry.editFrame = selPersonalizationEditFrame;
                selPersonalizationPageControl.geometry.resizeHandle = selPersonalizationResizeHandle;
                selPersonalizationBindPageControlGeometryAction(
                    selPersonalizationPageControl,
                    selPersonalizationPageControl.root,
                    selPersonalizationPageControl.geometry.flowKey ? "select" : "move"
                );
                selPersonalizationBindPageControlGeometryAction(
                    selPersonalizationPageControl,
                    selPersonalizationResizeHandle,
                    "resize"
                );
            }
            const selPersonalizationUsesSharedEdit = selPersonalizationDefinition.sharedEdit?.host instanceof Element
                && String(selPersonalizationDefinition.sharedEdit.key || "").trim();
            selPersonalizationPageControl.editButtons = selPersonalizationUsesSharedEdit ? [] : selPersonalizationPageControl.editHosts.map((selPersonalizationEditHost) => {
                if (selPersonalizationPageControl.geometry && !selPersonalizationPageControl.geometry.direct) {
                    selPersonalizationEditHost.classList.add("selpersonal-page-geometry-host");
                    [
                        { action: "move", icon: "ri-drag-move-2-line", label: `拖动${selPersonalizationPageControl.title}` },
                        { action: "resize", icon: "ri-expand-width-line", label: `调整${selPersonalizationPageControl.title}宽度` }
                    ].forEach((selPersonalizationGeometryAction) => {
                        const selPersonalizationGeometryButton = document.createElement("button");
                        selPersonalizationGeometryButton.type = "button";
                        selPersonalizationGeometryButton.className = `selpersonal-page-geometry-action selpersonal-page-geometry-${selPersonalizationGeometryAction.action}`;
                        selPersonalizationGeometryButton.hidden = true;
                        selPersonalizationGeometryButton.setAttribute("aria-label", selPersonalizationGeometryAction.label);
                        selPersonalizationGeometryButton.innerHTML = `<i class="${selPersonalizationGeometryAction.icon}" aria-hidden="true"></i><span>${selPersonalizationGeometryAction.label}</span>`;
                        selPersonalizationEditHost.appendChild(selPersonalizationGeometryButton);
                        selPersonalizationBindPageControlGeometryAction(
                            selPersonalizationPageControl,
                            selPersonalizationGeometryButton,
                            selPersonalizationGeometryAction.action
                        );
                        selPersonalizationPageControl.geometryButtons.push(selPersonalizationGeometryButton);
                    });
                }
                const selPersonalizationEditButton = document.createElement("button");
                selPersonalizationEditButton.type = "button";
                selPersonalizationEditButton.className = "selpersonal-page-control-edit";
                selPersonalizationEditButton.hidden = true;
                selPersonalizationEditButton.innerHTML = `<i class="ri-save-3-line" aria-hidden="true"></i><span>保存${selPersonalizationPageControl.typeLabel}</span>`;
                selPersonalizationEditButton.addEventListener("click", selPersonalizationHandleEdit);
                selPersonalizationEditHost.appendChild(selPersonalizationEditButton);
                return selPersonalizationEditButton;
            });
            selPersonalizationPageControls.set(selPersonalizationPageControl.id, selPersonalizationPageControl);
            if (selPersonalizationPageControl.geometry?.flowKey) {
                const selPersonalizationFlowKey = selPersonalizationPageControl.geometry.flowKey;
                let selPersonalizationFlowGroup = selPersonalizationPageControlFlowGroups.get(selPersonalizationFlowKey);
                if (!selPersonalizationFlowGroup) {
                    selPersonalizationFlowGroup = {
                        controlIds: [],
                        gap: Math.max(0, Number(selPersonalizationDefinition.geometry.flow?.gap) || 12)
                    };
                    selPersonalizationPageControlFlowGroups.set(selPersonalizationFlowKey, selPersonalizationFlowGroup);
                }
                selPersonalizationFlowGroup.controlIds.push(selPersonalizationPageControl.id);
                selPersonalizationPageControl.root.classList.add("selpersonal-page-flow-geometry");
            }
            if (selPersonalizationUsesSharedEdit) {
                const selPersonalizationSharedEditKey = String(selPersonalizationDefinition.sharedEdit.key).trim();
                let selPersonalizationSharedAction = selPersonalizationSharedPageControlActions.get(selPersonalizationSharedEditKey);
                if (!selPersonalizationSharedAction) {
                    const selPersonalizationSharedButton = document.createElement("button");
                    selPersonalizationSharedButton.type = "button";
                    selPersonalizationSharedButton.className = "selpersonal-page-control-edit selpersonal-page-shared-control-edit";
                    selPersonalizationSharedButton.hidden = true;
                    selPersonalizationSharedButton.innerHTML = '<i class="ri-save-3-line" aria-hidden="true"></i><span>保存当前控件</span>';
                    selPersonalizationDefinition.sharedEdit.host.classList.add("selpersonal-page-shared-edit-host");
                    selPersonalizationDefinition.sharedEdit.host.appendChild(selPersonalizationSharedButton);
                    selPersonalizationSharedAction = {
                        button: selPersonalizationSharedButton,
                        controlIds: new Set(),
                        label: String(selPersonalizationDefinition.sharedEdit.label || "保存当前控件"),
                        host: selPersonalizationDefinition.sharedEdit.host,
                        followControlId: ""
                    };
                    selPersonalizationSharedButton.addEventListener("click", async () => {
                        const selPersonalizationTarget = selPersonalizationPageControls.get(
                            selPersonalizationSharedButton.dataset.selPersonalPageControl || ""
                        );
                        try {
                            await selPersonalizationSavePageControl(selPersonalizationTarget);
                        } catch (selPersonalizationError) {
                            console.error("共享页面控件保存动作失败。", selPersonalizationError);
                        }
                    });
                    selPersonalizationSharedPageControlActions.set(selPersonalizationSharedEditKey, selPersonalizationSharedAction);
                }
                selPersonalizationSharedAction.controlIds.add(selPersonalizationPageControl.id);
                if (selPersonalizationDefinition.sharedEdit.follow === true) {
                    selPersonalizationSharedAction.followControlId = selPersonalizationPageControl.id;
                }
            }
            if (!selPersonalizationSelectedPageControlId) selPersonalizationSelectedPageControlId = selPersonalizationPageControl.id;
            selPersonalizationSyncPageMode();
            return true;
        }

        /** 更新同一物理控件当前业务模块的名称、坐标和保存适配器。 */
        function selPersonalizationUpdatePageControl(selPersonalizationPageControlId, selPersonalizationDefinition = {}) {
            const selPersonalizationPageControl = selPersonalizationPageControls.get(String(selPersonalizationPageControlId || ""));
            if (!selPersonalizationPageControl) return false;
            const selPersonalizationNextRoot = selPersonalizationDefinition.root instanceof Element
                ? selPersonalizationDefinition.root : null;
            if (selPersonalizationNextRoot && selPersonalizationNextRoot !== selPersonalizationPageControl.root) {
                selPersonalizationPageControl.root.classList.remove("selpersonal-page-direct-geometry", "selpersonal-page-flow-geometry");
                selPersonalizationPageControl.root = selPersonalizationNextRoot;
                selPersonalizationPageControl.roots = [selPersonalizationNextRoot];
                if (selPersonalizationPageControl.geometry?.direct) {
                    selPersonalizationNextRoot.classList.add("selpersonal-page-direct-geometry");
                    if (selPersonalizationPageControl.geometry.flowKey) {
                        selPersonalizationNextRoot.classList.add("selpersonal-page-flow-geometry");
                    }
                    selPersonalizationBindPageControlGeometryAction(
                        selPersonalizationPageControl,
                        selPersonalizationNextRoot,
                        selPersonalizationPageControl.geometry.flowKey ? "select" : "move"
                    );
                }
            }
            if (selPersonalizationDefinition.title) selPersonalizationPageControl.title = String(selPersonalizationDefinition.title);
            if (selPersonalizationDefinition.typeLabel) selPersonalizationPageControl.typeLabel = String(selPersonalizationDefinition.typeLabel);
            if (selPersonalizationDefinition.icon) selPersonalizationPageControl.icon = String(selPersonalizationDefinition.icon);
            if (Array.isArray(selPersonalizationDefinition.coordinates)) {
                selPersonalizationPageControl.coordinates = selPersonalizationDefinition.coordinates.map((selPersonalizationCoordinate) => ({
                    label: String(selPersonalizationCoordinate.label || "坐标"), value: String(selPersonalizationCoordinate.value || "—")
                }));
            }
            if (typeof selPersonalizationDefinition.captureState === "function") selPersonalizationPageControl.captureState = selPersonalizationDefinition.captureState;
            if (typeof selPersonalizationDefinition.saveState === "function") selPersonalizationPageControl.saveState = selPersonalizationDefinition.saveState;
            if (typeof selPersonalizationDefinition.onEdit === "function") {
                selPersonalizationPageControl.onEdit = selPersonalizationDefinition.onEdit;
                selPersonalizationPageControl.actionOnly = true;
            }
            if (typeof selPersonalizationDefinition.enabled === "boolean") {
                selPersonalizationPageControl.enabled = selPersonalizationDefinition.enabled;
            }
            if (selPersonalizationPageControl.geometry && selPersonalizationDefinition.geometry) {
                const selPersonalizationNextGeometry = selPersonalizationDefinition.geometry;
                if (selPersonalizationNextGeometry.container instanceof Element) {
                    selPersonalizationPageControl.geometry.container = selPersonalizationNextGeometry.container;
                }
                if (Number.isFinite(Number(selPersonalizationNextGeometry.minWidth))) {
                    selPersonalizationPageControl.geometry.minWidth = Math.max(1, Number(selPersonalizationNextGeometry.minWidth));
                }
                if (Number.isFinite(Number(selPersonalizationNextGeometry.maxWidth))) {
                    selPersonalizationPageControl.geometry.maxWidth = Math.max(1, Number(selPersonalizationNextGeometry.maxWidth));
                }
                if (Number.isFinite(Number(selPersonalizationNextGeometry.flow?.order))) {
                    selPersonalizationPageControl.geometry.flowOrder = Number(selPersonalizationNextGeometry.flow.order);
                }
                window.requestAnimationFrame(() => selPersonalizationApplyPageControlGeometry(
                    selPersonalizationPageControl,
                    selPersonalizationNextGeometry.state || selPersonalizationPageControl.captureState()
                ));
            }
            selPersonalizationPageControl.editButtons.forEach((selPersonalizationEditButton) => {
                selPersonalizationEditButton.querySelector("span").textContent = `保存${selPersonalizationPageControl.typeLabel}`;
            });
            selPersonalizationRenderPageControls();
            return true;
        }

        selPersonalizationPageControlsHost?.addEventListener("click", (selPersonalizationEvent) => {
            const selPersonalizationPageControlButton = selPersonalizationEvent.target.closest("[data-sel-personal-page-control]");
            if (selPersonalizationPageControlButton) selPersonalizationSelectPageControl(selPersonalizationPageControlButton.dataset.selPersonalPageControl);
        });
        selPersonalizationPageEditSwitch?.addEventListener("change", async () => {
            const selPersonalizationChanged = await selPersonalizationSetPageMode(selPersonalizationPageEditSwitch.checked ? "edit" : "preview");
            if (!selPersonalizationChanged) selPersonalizationSyncPageMode();
        });
        selPersonalizationSyncPageMode();

        /** 根据主题模式的正式背景 ID 解析缩略图素材，预览不复制主题图片路径。 */
        function selPersonalizationResolveThemePreviewImage(selPersonalizationThemeMode) {
            const selPersonalizationBackgroundTheme = selPersonalizationBackgroundController.themes.find((selPersonalizationTheme) => selPersonalizationTheme.id === selPersonalizationThemeMode?.base?.backgroundTheme);
            if (!selPersonalizationBackgroundTheme?.image) return "none";
            // 背景注册表中的相对路径以 page-background 组件目录为基准，转成绝对地址后再放入主题卡行内令牌。
            const selPersonalizationBackgroundBase = new URL("/sel/components/page-background/", document.baseURI);
            return `url('${new URL(selPersonalizationBackgroundTheme.image, selPersonalizationBackgroundBase).href}')`;
        }

        /** 创建一张同时展示深浅模式的主题卡，主题数量增加时仍保持一主题一卡。 */
        function selPersonalizationCreateThemeCard(selPersonalizationTheme, selPersonalizationCompact = false) {
            const selPersonalizationThemeButton = document.createElement("button");
            selPersonalizationThemeButton.className = selPersonalizationCompact ? "selpersonal-theme-card selpersonal-theme-card-compact" : "selpersonal-theme-card";
            selPersonalizationThemeButton.type = "button";
            selPersonalizationThemeButton.dataset.selPersonalTheme = selPersonalizationTheme.id;
            selPersonalizationThemeButton.setAttribute("aria-pressed", String(selPersonalizationTheme.id === selPersonalizationThemeState));
            const selPersonalizationThemeModes = selPersonalizationTheme.modes.slice(0, 2);
            const selPersonalizationThemePreviews = selPersonalizationThemeModes.map((selPersonalizationThemeMode) => {
                // 最近使用卡片宽度较窄，深浅模式使用本地化短标签并保持十二像素字号。
                const selPersonalizationThemeModeLabel = selPersonalizationCompact && selPersonalizationThemeMode.id === "dark"
                    ? "深色"
                    : selPersonalizationCompact && selPersonalizationThemeMode.id === "light"
                        ? "浅色"
                        : selPersonalizationThemeMode.label;
                return `
                <span class="selpersonal-theme-card-mode" style="--selpersonal-theme-mode-image:${selPersonalizationResolveThemePreviewImage(selPersonalizationThemeMode)};--selpersonal-theme-mode-frame:url('${selPersonalizationThemeMode.base.frameImage}')">
                    <span>${selPersonalizationTranslate(selPersonalizationThemeModeLabel)}</span>
                </span>`;
            }).join("");
            selPersonalizationThemeButton.innerHTML = `<span class="selpersonal-theme-card-preview" aria-hidden="true">${selPersonalizationThemePreviews}</span><span class="selpersonal-theme-card-copy"><strong>${selPersonalizationTranslate(selPersonalizationTheme.name)}</strong><small>${selPersonalizationTranslate(selPersonalizationTheme.description || "可扩展主题包")}</small></span><i class="ri-checkbox-circle-fill selpersonal-theme-card-selected" aria-hidden="true"></i>`;
            return selPersonalizationThemeButton;
        }

        /** 按搜索词和主题分类刷新可滚动主题库。 */
        function selPersonalizationFilterThemeLibrary() {
            const selPersonalizationThemeQuery = selPersonalizationThemeSearch.value.trim().toLocaleLowerCase(selPersonalizationLocale);
            const selPersonalizationThemeCategoryValue = selPersonalizationThemeCategory.value;
            let selPersonalizationVisibleThemeCount = 0;
            selPersonalizationThemeGrid.querySelectorAll("[data-sel-personal-theme]").forEach((selPersonalizationThemeButton) => {
                const selPersonalizationTheme = selPersonalizationThemes.find((selPersonalizationItem) => selPersonalizationItem.id === selPersonalizationThemeButton.dataset.selPersonalTheme);
                const selPersonalizationThemeText = `${selPersonalizationTranslate(selPersonalizationTheme?.name || "")} ${selPersonalizationTranslate(selPersonalizationTheme?.description || "")}`.toLocaleLowerCase(selPersonalizationLocale);
                const selPersonalizationThemeMatches = (!selPersonalizationThemeQuery || selPersonalizationThemeText.includes(selPersonalizationThemeQuery))
                    && (!selPersonalizationThemeCategoryValue || selPersonalizationTheme?.category === selPersonalizationThemeCategoryValue);
                selPersonalizationThemeButton.hidden = !selPersonalizationThemeMatches;
                if (selPersonalizationThemeMatches) selPersonalizationVisibleThemeCount += 1;
            });
            selPersonalizationThemeEmpty.hidden = selPersonalizationVisibleThemeCount > 0;
            selPersonalizationThemeLibraryCount.value = selPersonalizationFormat("themeLibraryCount", { visible: selPersonalizationVisibleThemeCount, total: selPersonalizationThemes.length }, `${selPersonalizationVisibleThemeCount}/${selPersonalizationThemes.length} 个主题`);
        }

        /** 按当前注册表重新绘制主题库、最近使用、明暗模式和当前模式颜色组合。 */
        function selPersonalizationRenderThemeOptions() {
            selPersonalizationThemeGrid.replaceChildren();
            selPersonalizationCurrentTheme.replaceChildren();
            selPersonalizationRecentThemes.replaceChildren();
            selPersonalizationSkinGrid.replaceChildren();
            selPersonalizationSkinThemeRows.replaceChildren();
            const selPersonalizationCurrentThemeDefinition = selPersonalizationThemes.find((selPersonalizationTheme) => selPersonalizationTheme.id === selPersonalizationThemeState) || selPersonalizationThemes[0];
            if (selPersonalizationCurrentThemeDefinition) {
                selPersonalizationCurrentTheme.appendChild(selPersonalizationCreateThemeCard(selPersonalizationCurrentThemeDefinition));
            }
            selPersonalizationRecentThemeIds.forEach((selPersonalizationThemeId) => {
                const selPersonalizationTheme = selPersonalizationThemes.find((selPersonalizationItem) => selPersonalizationItem.id === selPersonalizationThemeId);
                if (selPersonalizationTheme) selPersonalizationRecentThemes.appendChild(selPersonalizationCreateThemeCard(selPersonalizationTheme, true));
            });
            const selPersonalizationCategories = [...new Set(selPersonalizationThemes.map((selPersonalizationTheme) => selPersonalizationTheme.category || "其他"))];
            const selPersonalizationPreviousCategory = selPersonalizationThemeCategory.value;
            selPersonalizationThemeCategory.replaceChildren();
            [{ value: "", label: "全部分类" }, ...selPersonalizationCategories.map((selPersonalizationCategory) => ({ value: selPersonalizationCategory, label: selPersonalizationCategory }))].forEach((selPersonalizationCategory) => {
                const selPersonalizationCategoryOption = document.createElement("option");
                selPersonalizationCategoryOption.value = selPersonalizationCategory.value;
                selPersonalizationCategoryOption.textContent = selPersonalizationTranslate(selPersonalizationCategory.label);
                selPersonalizationThemeCategory.appendChild(selPersonalizationCategoryOption);
            });
            if ([...selPersonalizationThemeCategory.options].some((selPersonalizationOption) => selPersonalizationOption.value === selPersonalizationPreviousCategory)) {
                selPersonalizationThemeCategory.value = selPersonalizationPreviousCategory;
            }
            // 公共下拉的标题和当前值模板跟随公共国际化，原生 select 仍是筛选值唯一来源。
            const selPersonalizationThemeCategoryLabel = selPersonalizationTranslate("主题分类");
            selPersonalizationThemeCategory.setAttribute("aria-label", selPersonalizationThemeCategoryLabel);
            selPersonalizationThemeCategoryRoot.dataset.selDropdownMenuLabel = selPersonalizationThemeCategoryLabel;
            selPersonalizationThemeCategoryRoot.dataset.selDropdownMenuTitle = selPersonalizationThemeCategoryLabel;
            selPersonalizationThemeCategoryRoot.dataset.selDropdownMenuCurrentTemplate = selPersonalizationTemplates.themeCategoryCurrent || "{label}：{value}";
            if (selPersonalizationThemeCategoryDropdown) {
                window.sel.components.dropdownMenu.setLocale(selPersonalizationThemeCategoryRoot);
            }
            selPersonalizationThemes.forEach((selPersonalizationTheme) => {
                selPersonalizationThemeGrid.appendChild(selPersonalizationCreateThemeCard(selPersonalizationTheme));
            });
            selPersonalizationSkins.forEach((selPersonalizationSkin) => {
                const selPersonalizationSkinButton = document.createElement("button");
                selPersonalizationSkinButton.className = "selpersonal-skin-option";
                selPersonalizationSkinButton.type = "button";
                selPersonalizationSkinButton.dataset.selPersonalSkin = selPersonalizationSkin.id;
                selPersonalizationSkinButton.style.setProperty("--selpersonal-skin-frame-image", `url("${selPersonalizationSkin.base.frameImage}")`);
                selPersonalizationSkinButton.style.setProperty("--selpersonal-skin-preview-surface", selPersonalizationSkin.preview.surface);
                selPersonalizationSkinButton.style.setProperty("--selpersonal-skin-card-surface", selPersonalizationSkin.preview.card);
                selPersonalizationSkinButton.style.setProperty("--selpersonal-skin-preview-main", selPersonalizationSkin.preview.main);
                selPersonalizationSkinButton.style.setProperty("--selpersonal-skin-preview-muted", selPersonalizationSkin.preview.muted);
                selPersonalizationSkinButton.style.setProperty("--selpersonal-skin-preview-accent", selPersonalizationSkin.preview.accent);
                selPersonalizationSkinButton.setAttribute("aria-pressed", "false");
                selPersonalizationSkinButton.innerHTML = `<span class="selpersonal-skin-preview" aria-hidden="true"><i class="${selPersonalizationSkin.icon}"></i></span><span class="selpersonal-skin-copy"><strong>${selPersonalizationTranslate(selPersonalizationSkin.label)}</strong><small>${selPersonalizationTranslate(selPersonalizationSkin.description)}</small></span><i class="ri-checkbox-circle-fill selpersonal-skin-selected-icon" aria-hidden="true"></i>`;
                selPersonalizationSkinGrid.appendChild(selPersonalizationSkinButton);

                const selPersonalizationThemeRow = document.createElement("div");
                selPersonalizationThemeRow.className = "selpersonal-skin-theme-row";
                selPersonalizationThemeRow.dataset.selPersonalThemeSkinRow = selPersonalizationSkin.id;
                selPersonalizationThemeRow.hidden = selPersonalizationSkin.id !== selPersonalizationSkinState;
                const selPersonalizationThemeRowLabel = document.createElement("strong");
                selPersonalizationThemeRowLabel.textContent = selPersonalizationFormat("accentRow", { label: selPersonalizationTranslate(selPersonalizationSkin.label) }, "{label}配色");
                const selPersonalizationThemeSwatches = document.createElement("div");
                selPersonalizationThemeSwatches.className = "selpersonal-color-swatches selpersonal-skin-theme-swatches";
                selPersonalizationThemeSwatches.setAttribute("role", "group");
                selPersonalizationThemeSwatches.setAttribute("aria-label", selPersonalizationFormat("swatchGroup", { label: selPersonalizationThemeRowLabel.textContent }, "{label}色板"));
                const selPersonalizationBaseSwatch = document.createElement("button");
                selPersonalizationBaseSwatch.className = "selpersonal-color-swatch selpersonal-color-swatch-base";
                selPersonalizationBaseSwatch.type = "button";
                selPersonalizationBaseSwatch.dataset.selPersonalThemeSwatch = "base";
                selPersonalizationBaseSwatch.dataset.selPersonalThemeBase = "true";
                selPersonalizationBaseSwatch.dataset.selPersonalThemeSkin = selPersonalizationSkin.id;
                selPersonalizationBaseSwatch.style.setProperty("--selpersonal-swatch-color", selPersonalizationSkin.base.color);
                selPersonalizationBaseSwatch.setAttribute("aria-label", `${selPersonalizationThemeRowLabel.textContent} · ${selPersonalizationTranslate(selPersonalizationSkin.themeLabel)}`);
                selPersonalizationBaseSwatch.setAttribute("aria-pressed", "false");
                selPersonalizationBaseSwatch.innerHTML = `<i class="${selPersonalizationSkin.icon}" aria-hidden="true"></i>`;
                selPersonalizationThemeSwatches.appendChild(selPersonalizationBaseSwatch);
                selPersonalizationSkin.accents.forEach((selPersonalizationAccent) => {
                    const selPersonalizationSwatch = document.createElement("button");
                    selPersonalizationSwatch.className = "selpersonal-color-swatch";
                    selPersonalizationSwatch.type = "button";
                    selPersonalizationSwatch.dataset.selPersonalThemeSwatch = selPersonalizationAccent.color;
                    selPersonalizationSwatch.dataset.selPersonalThemeAccent = selPersonalizationAccent.id;
                    selPersonalizationSwatch.dataset.selPersonalThemeSkin = selPersonalizationSkin.id;
                    selPersonalizationSwatch.style.setProperty("--selpersonal-swatch-color", selPersonalizationAccent.color);
                    selPersonalizationSwatch.setAttribute("aria-label", `${selPersonalizationThemeRowLabel.textContent} · ${selPersonalizationTranslate(selPersonalizationAccent.label)}`);
                    selPersonalizationSwatch.setAttribute("aria-pressed", "false");
                    selPersonalizationThemeSwatches.appendChild(selPersonalizationSwatch);
                });
                selPersonalizationThemeRow.append(selPersonalizationThemeRowLabel, selPersonalizationThemeSwatches);
                selPersonalizationSkinThemeRows.appendChild(selPersonalizationThemeRow);
            });
            selPersonalizationLocalizeNode(selPersonalizationThemeGrid);
            selPersonalizationLocalizeNode(selPersonalizationCurrentTheme);
            selPersonalizationLocalizeNode(selPersonalizationRecentThemes);
            selPersonalizationLocalizeNode(selPersonalizationSkinGrid);
            selPersonalizationLocalizeNode(selPersonalizationSkinThemeRows);
            selPersonalizationFilterThemeLibrary();
        }
        selPersonalizationRenderThemeOptions();
        // 个性化面板为运行时创建，不在应用首次 mountAll 的扫描范围内，必须在这里显式装配公共下拉。
        selPersonalizationThemeCategoryDropdown = window.sel.components.dropdownMenu?.mount(selPersonalizationThemeCategoryRoot) || null;
        if (!selPersonalizationThemeCategoryDropdown) return null;

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
            selPersonalizationThemeName.textContent = selPersonalizationTranslate(selPersonalizationTheme.name);
            const selPersonalizationThemeCategory = document.createElement("span");
            selPersonalizationThemeCategory.textContent = selPersonalizationTranslate(selPersonalizationTheme.category);
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
            selPersonalizationPresetButton.innerHTML = `<i class="${selPersonalizationPreset.icon}" aria-hidden="true"></i><span>${selPersonalizationTranslate(selPersonalizationPreset.label)}</span>`;
            selPersonalizationPresetGrid.appendChild(selPersonalizationPresetButton);
        });

        // 四个文字模式以原生按钮生成，便于未来皮肤替换默认文字色而不改模板。
        selPersonalizationTextModes.forEach((selPersonalizationTextMode) => {
            // 每个按钮写入稳定模式标识，点击事件只读取固定配置。
            const selPersonalizationTextModeButton = document.createElement("button");
            selPersonalizationTextModeButton.className = "selpersonal-text-mode";
            selPersonalizationTextModeButton.type = "button";
            selPersonalizationTextModeButton.dataset.selPersonalTextMode = selPersonalizationTextMode.id;
            selPersonalizationTextModeButton.setAttribute("aria-pressed", "false");
            selPersonalizationTextModeButton.innerHTML = `<i class="${selPersonalizationTextMode.icon}" aria-hidden="true"></i><span>${selPersonalizationTranslate(selPersonalizationTextMode.label)}</span>`;
            selPersonalizationTextModeGrid.appendChild(selPersonalizationTextModeButton);
        });

        // 面板分组根据固定配置生成一致的 range 行。
        selPersonalizationPanelRangeGroups.forEach((selPersonalizationGroup) => {
            // 每个分组拥有独立标题与业务说明区域。
            const selPersonalizationSection = document.createElement("section");
            selPersonalizationSection.className = "selpersonal-section";
            selPersonalizationSection.dataset.selPersonalGroup = selPersonalizationGroup.id;
            const selPersonalizationSectionHeader = document.createElement("header");
            selPersonalizationSectionHeader.className = "selpersonal-section-heading";
            selPersonalizationSectionHeader.innerHTML = `<span><i class="${selPersonalizationGroup.icon}" aria-hidden="true"></i><strong>${selPersonalizationTranslate(selPersonalizationGroup.title)}</strong></span>`;
            selPersonalizationSection.appendChild(selPersonalizationSectionHeader);
            // 当前分组中的每项设置共享百分比输入结构。
            selPersonalizationGroup.items.forEach((selPersonalizationItem) => {
                // 常规滑杆上限为 100，只有规则登记的内板比例项读取 150 例外值。
                const selPersonalizationRangeMaximum = Number(selPersonalizationItem.maximum || 100);
                // label 让名称、range 和输出具备原生关联。
                const selPersonalizationRange = document.createElement("label");
                selPersonalizationRange.className = "selpersonal-panel-range";
                selPersonalizationRange.innerHTML = `
                    <span class="selpersonal-panel-range-copy"><strong>${selPersonalizationTranslate(selPersonalizationItem.label)}</strong><small>${selPersonalizationTranslate(selPersonalizationItem.hint)}</small></span>
                    <span class="selpersonal-panel-range-control"><input type="range" min="0" max="${selPersonalizationRangeMaximum}" step="1" data-sel-personal-panel-range="${selPersonalizationItem.key}"><output data-sel-personal-panel-output="${selPersonalizationItem.key}"></output></span>
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
        // 静态模板和动态配置渲染完成后统一应用公共文案，不触碰项目业务面板。
        selPersonalizationLocalizeNode(selPersonalizationControl);

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
         * 同步皮肤预览卡的选中语义。
         * @returns {void} 只更新当前个性化界面，不改变其他设置状态。
         */
        function selPersonalizationSyncSkin() {
            selPersonalizationControl.querySelectorAll("[data-sel-personal-theme]").forEach((selPersonalizationThemeButton) => {
                selPersonalizationThemeButton.setAttribute("aria-pressed", String(selPersonalizationThemeButton.dataset.selPersonalTheme === selPersonalizationThemeState));
            });
            selPersonalizationSkinGrid.querySelectorAll("[data-sel-personal-skin]").forEach((selPersonalizationSkinButton) => {
                selPersonalizationSkinButton.setAttribute("aria-pressed", String(selPersonalizationSkinButton.dataset.selPersonalSkin === selPersonalizationSkinState));
            });
            // 配色只有模式与 Accent 同时命中时才显示选中，深浅两行不会互相误选。
            selPersonalizationSkinThemeRows.querySelectorAll("[data-sel-personal-theme-swatch]").forEach((selPersonalizationSwatch) => {
                const selPersonalizationBaseSelected = selPersonalizationSwatch.dataset.selPersonalThemeBase === "true"
                    && !selPersonalizationPanelState.themeAccent
                    && !selPersonalizationPanelState.themeColor;
                const selPersonalizationThemeSelected = selPersonalizationSwatch.dataset.selPersonalThemeSkin === selPersonalizationSkinState
                    && (selPersonalizationBaseSelected
                        || selPersonalizationSwatch.dataset.selPersonalThemeAccent === selPersonalizationPanelState.themeAccent);
                selPersonalizationSwatch.setAttribute("aria-pressed", String(selPersonalizationThemeSelected));
            });
            // 一次只展示当前模式对应的七套皮肤，避免深浅十四套同时占满浮层。
            selPersonalizationSkinThemeRows.querySelectorAll("[data-sel-personal-theme-skin-row]").forEach((selPersonalizationThemeRow) => {
                selPersonalizationThemeRow.hidden = selPersonalizationThemeRow.dataset.selPersonalThemeSkinRow !== selPersonalizationSkinState;
            });
        }

        /**
         * 根据当前模式和正式 Accent ID 查找颜色与素材；自定义颜色没有独立图片包。
         * @returns {object|null} 命中色板时返回不可变配置，否则返回 null。
         */
        function selPersonalizationResolveThemeColor() {
            const selPersonalizationSkin = selPersonalizationSkins.find((selPersonalizationItem) => selPersonalizationItem.id === selPersonalizationSkinState);
            return selPersonalizationSkin?.accents.find((selPersonalizationAccent) => selPersonalizationAccent.id === selPersonalizationPanelState.themeAccent) || null;
        }

        /**
         * 同步色板对应的深浅边框和配套背景；跟随皮肤或自定义颜色恢复当前皮肤默认素材。
         * @param {boolean} selPersonalizationUpdateBackground - true 时同时切换配套背景及显示参数。
         * @returns {void}
         */
        function selPersonalizationApplyThemeAssets(selPersonalizationUpdateBackground = false) {
            const selPersonalizationSkin = selPersonalizationSkins.find((selPersonalizationItem) => selPersonalizationItem.id === selPersonalizationSkinState)
                || selPersonalizationSkins.find((selPersonalizationItem) => selPersonalizationItem.id === selPersonalizationDefaultSkin);
            const selPersonalizationTheme = selPersonalizationResolveThemeColor();
            selPersonalizationThemeManager.setAccent(selPersonalizationTheme?.id || null);
            selPersonalizationDocumentRoot.dataset.selThemeAsset = selPersonalizationTheme?.id || "follow-skin";
            if (!selPersonalizationUpdateBackground) {
                return;
            }
            const selPersonalizationMaterial = selPersonalizationTheme || selPersonalizationSkin.base;
            const selPersonalizationBackgroundTheme = selPersonalizationMaterial.backgroundTheme;
            selPersonalizationBackgroundController.setTheme(selPersonalizationBackgroundTheme);
            selPersonalizationBackgroundController.setDisplay(selPersonalizationMaterial.backgroundDisplay);
            selPersonalizationSyncBackground();
        }

        /**
         * 应用一个正式皮肤标识，并同步浏览器原生控件的明暗模式。
         * @param {string} selPersonalizationSkinId - dark 或 light。
         * @returns {boolean} 皮肤存在并成功应用时返回 true。
         */
        function selPersonalizationApplySkin(selPersonalizationSkinId) {
            const selPersonalizationSkin = selPersonalizationSkins.find((selPersonalizationItem) => selPersonalizationItem.id === selPersonalizationSkinId);
            if (!selPersonalizationSkin) {
                return false;
            }
            selPersonalizationSkinState = selPersonalizationSkinId;
            selPersonalizationThemeManager.setMode(selPersonalizationSkinState);
            // 当前皮肤拥有独立默认值；非自定义预设在换肤时同步切换到对应参数组。
            selPersonalizationDefaults = selPersonalizationResolveDefaults(selPersonalizationSkinState);
            const selPersonalizationActivePreset = selPersonalizationPresets.find((selPersonalizationPreset) => selPersonalizationPreset.id === selPersonalizationPanelState.preset);
            const selPersonalizationActiveValues = selPersonalizationActivePreset?.values?.[selPersonalizationSkinState];
            if (selPersonalizationActiveValues) {
                selPersonalizationPanelState = { ...selPersonalizationPanelState, ...selPersonalizationActiveValues };
            }
            // 每次主动切换皮肤时同步当前色板在新皮肤下的独立边框、配套背景和显示参数。
            selPersonalizationApplyThemeAssets(true);
            selPersonalizationSyncSkin();
            document.dispatchEvent(new CustomEvent("selPersonalization:skin-change", { detail: selFreeze({ theme: selPersonalizationThemeState, skin: selPersonalizationSkinState }) }));
            return true;
        }

        /**
         * 把面板强度映射为所有水晶组件共享的 CSS 令牌。
         * @returns {void} 实时改变当前页面，不写入 localStorage 或其他缓存。
         */
        function selPersonalizationApplyPanel(selPersonalizationPreviewKey = "") {
            // 先让主题管理器应用正式 Accent 的独立颜色与素材，再由任意自定义色覆盖颜色令牌。
            const selPersonalizationThemeColor = selPersonalizationNormalizeColor(selPersonalizationPanelState.themeColor);
            selPersonalizationApplyThemeAssets(false);
            // 边框视觉强度统一驱动原图、静态外光和呼吸光效，0 表示完全移除边框痕迹。
            const selPersonalizationFrameVisualStrength = selPersonalizationPanelState.frameOpacity / 100;
            if (selPersonalizationThemeColor) {
                // 拖动取色器时只更新轻量主题令牌，内板、发光与交互状态可以逐帧响应。
                selPersonalizationDocumentRoot.style.setProperty("--sel-theme-color-rgb", selPersonalizationColorToRgb(selPersonalizationThemeColor));
            }
            // 原始九宫格图片直接消费用户百分比，不改变图片色彩和透明通道细节。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-frame-opacity", String(selPersonalizationFrameVisualStrength));
            // 中心底板透明度只作用于背景色，不降低文字、图标或边框 Alpha。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-panel-opacity", String(selPersonalizationPanelState.panelOpacity / 100));
            // 结构透明度记录与面板相同的用户强度，供表格装饰层和未来结构组件统一读取。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-structure-opacity", String(selPersonalizationPanelState.panelOpacity / 100));
            // 表格外壳只叠加最高 8% 颜色，防止它与面板底板复合后重新接近不透明。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-table-board-opacity", String(selPersonalizationMap(selPersonalizationPanelState.panelOpacity, 0, 0.08)));
            // 表头使用最高 12% 的轻量覆盖，列结构可辨识但仍清晰显示背景变化。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-table-header-opacity", String(selPersonalizationMap(selPersonalizationPanelState.panelOpacity, 0, 0.12)));
            // 普通行和偶数行分别使用最高 10% 与 16% 的覆盖，保留弱斑马纹而不遮挡面板透明度。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-table-row-opacity", String(selPersonalizationMap(selPersonalizationPanelState.panelOpacity, 0, 0.10)));
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-table-row-even-opacity", String(selPersonalizationMap(selPersonalizationPanelState.panelOpacity, 0, 0.16)));
            // 普通交互控件从 25% 起步，保证复杂背景上仍能看出可点击边界。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-control-base-opacity", String(selPersonalizationMap(selPersonalizationPanelState.panelOpacity, 0.25, 0.84)));
            // 悬停、选中和主操作 Alpha 由主题默认令牌固定提供，面板透明度不再改写交互反馈强度。
            // 背景磨砂将用户强度映射到 0 至 48px，大字和高对比表格在透明面板后方也不再保持清晰边缘。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-background-frost-blur", `${selPersonalizationMap(selPersonalizationPanelState.backgroundFrost, 0, 48)}px`);
            // 背景亮度从原始 100% 逐步压低到 58%，削弱穿透文字与面板内容的明暗竞争。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-background-frost-brightness", String(selPersonalizationMap(selPersonalizationPanelState.backgroundFrost, 1, 0.58)));
            // 背景饱和度最低降到 55%，防止表格状态色透过磨砂层抢占视觉层级。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-background-frost-saturation", String(selPersonalizationMap(selPersonalizationPanelState.backgroundFrost, 1, 0.55)));
            // 独立中性遮蔽层最高为 26%，它不依赖面板透明度，因此面板 0% 时磨砂仍有效。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-background-frost-veil", String(selPersonalizationMap(selPersonalizationPanelState.backgroundFrost, 0, 0.26)));
            // 染色强度只写比例；未来皮肤通过覆盖主题 RGB 令牌换色。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-theme-tint-strength", `${selPersonalizationPanelState.themeTint}%`);
            // 中心底板最多混入 32% 主题色，让整套皮肤能够明显脱离原始蓝色且保持文字可读。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-theme-tint-mix", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 32)}%`);
            // 结构层按同一强度生成柔和、基础、抬升和强调色阶，组件不再各自写死蓝色底板。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-tint-soft", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 22)}%`);
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-tint-base", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 34)}%`);
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-tint-raised", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 48)}%`);
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-tint-accent", `${selPersonalizationMap(selPersonalizationPanelState.themeTint, 0, 78)}%`);
            // 圆角滑杆只写偏移量，最终值由当前主题基准与偏移量相加，切换主题后不会退回水晶基准。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-radius-panel-offset", `${selPersonalizationCenteredMap(selPersonalizationPanelState.panelRadius, -14, 30)}px`);
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-radius-popup-offset", `${selPersonalizationCenteredMap(selPersonalizationPanelState.panelRadius, -9.5, 17.5)}px`);
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-radius-inner-offset", `${selPersonalizationCenteredMap(selPersonalizationPanelState.panelRadius, -12, 28)}px`);
            // 等比大小以 50% 为原始尺寸，向下最多缩小 18%，向上最多放大 2%，保留视口边缘的水晶高光安全区。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-panel-scale", String(Math.round((1 + selPersonalizationCenteredMap(selPersonalizationPanelState.panelScale, -0.18, 0.02)) * 100) / 100));
            // 大型内板以 50% 为原始比例，100% 扩展 8px，150% 继续扩展到 16px。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-surface-inset-large", `${-selPersonalizationCenteredMap(selPersonalizationPanelState.innerPanelFit, -12, 8)}px`);
            // 紧凑浮层以 50% 为原始比例，100% 扩展 6px，150% 扩展到 12px。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-surface-inset-popup", `${-selPersonalizationCenteredMap(selPersonalizationPanelState.innerPanelFit, -8, 6)}px`);
            // 边框厚度映射为 0.67 至 1.33 的统一缩放比例，50% 保持每个组件自己的原始厚度。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-frame-scale", String(selPersonalizationMap(selPersonalizationPanelState.frameWidth, 0.67, 1.33)));
            // 内容内边距把 0 至 100 映射为 -4 至 10px 的偏移量，默认 50 严格保持旧布局。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-content-inset-offset", `${selPersonalizationCenteredMap(selPersonalizationPanelState.contentInset, -4, 10)}px`);
            // 外框/内板间距独立映射到 6 至 12px，默认 9px，让内板贴近外框但不压住水晶亮边。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-shell-inset", `${selPersonalizationMap(selPersonalizationPanelState.panelInset, 6, 12)}px`);
            // 现有内容内边距只控制内板中文字，默认 14px，不再推动整个内板远离外框。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-inner-content-inset", `${selPersonalizationMap(selPersonalizationPanelState.contentInset, 10, 18)}px`);
            // 面板间距限制在 6 至 14px，保证紧凑视口仍保留中央内容。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-panel-gap", `${selPersonalizationMap(selPersonalizationPanelState.panelGap, 6, 14)}px`);
            // 发光扩散映射到 0 至 22px，并单独写强度供动效使用。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-glow-spread", `${selPersonalizationMap(selPersonalizationPanelState.glowSpread, 0, 22)}px`);
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-glow-strength", String(selPersonalizationPanelState.glowSpread / 100));
            // 静态边框外光同时乘以扩散强度与边框透明度；任一项为 0 时都不残留彩色轮廓。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-frame-glow-alpha", String(Math.round((selPersonalizationPanelState.glowSpread / 100) * 0.78 * selPersonalizationFrameVisualStrength * 1000) / 1000));
            // 个性化浮层保留独立暗影，但其彩色边框外光必须与边框图片同步衰减。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-frame-panel-glow-alpha", String(Math.round(0.42 * selPersonalizationFrameVisualStrength * 1000) / 1000));
            // 活动窗口的强调外光继续高于普通面板，但边框为 0% 时同样完全透明。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-frame-active-glow-alpha", String(Math.round(0.68 * selPersonalizationFrameVisualStrength * 1000) / 1000));
            // 控件间距扩大到 -5 至 12px 的可感知范围，50% 保持旧密度且不改变最小点击尺寸。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-control-gap-offset", `${selPersonalizationCenteredMap(selPersonalizationPanelState.controlGap, -5, 12)}px`);
            // 窗口动画强度同时决定入场时长和位移幅度。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-window-motion-duration", `${selPersonalizationMap(selPersonalizationPanelState.windowMotion, 0, 300)}ms`);
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-window-motion-distance", `${selPersonalizationMap(selPersonalizationPanelState.windowMotion, 0, 14)}px`);
            // 光效流动写入不透明度和周期；0% 时 CSS 会直接停止动画。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-glow-motion-strength", String(selPersonalizationPanelState.glowMotion / 100));
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-glow-motion-duration", `${selPersonalizationMap(100 - selPersonalizationPanelState.glowMotion, 2.2, 12)}s`);
            // 呼吸动画的起止 Alpha 同时乘以边框视觉强度，中间值平滑衰减，0% 两端都不可见。
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-frame-motion-from-alpha", String(Math.round((0.12 + ((selPersonalizationPanelState.glowMotion / 100) * 0.20)) * selPersonalizationFrameVisualStrength * 1000) / 1000));
            selPersonalizationDocumentRoot.style.setProperty("--selpersonal-frame-motion-to-alpha", String(Math.round((0.18 + ((selPersonalizationPanelState.glowMotion / 100) * 0.42)) * selPersonalizationFrameVisualStrength * 1000) / 1000));
            // 页面标识统一控制用户开关和系统减少动态偏好的降级路径。
            selPersonalizationDocumentRoot.dataset.selPersonalReducedMotion = String(selPersonalizationPanelState.reducedMotion);
            // 发光扩散、流动强度或边框透明度任一为 0 时停止边框动画，避免 0px 模糊产生锐利彩色轮廓。
            selPersonalizationDocumentRoot.dataset.selPersonalGlowMotion = (
                selPersonalizationPanelState.glowMotion === 0
                || selPersonalizationPanelState.glowSpread === 0
                || selPersonalizationPanelState.frameOpacity === 0
            ) ? "off" : "on";
            selPersonalizationDocumentRoot.dataset.selPersonalPreset = selPersonalizationPanelState.preset;
            // 只在用户拖动窗口动画滑杆时重播当前可见窗口，让强度变化获得即时视觉反馈。
            if (selPersonalizationPreviewKey === "windowMotion" && !selPersonalizationPanelState.reducedMotion && selPersonalizationPanelState.windowMotion > 0) {
                document.querySelectorAll(".selwindow-window-shell").forEach((selPersonalizationWindowShell) => {
                    // 先移除预览类并强制提交当前帧，保证连续拖动也能重新开始动画。
                    selPersonalizationWindowShell.classList.remove("selwindow-window-motion-preview");
                    void selPersonalizationWindowShell.offsetWidth;
                    // 独立预览关键帧不会覆盖窗口当前 left、top、width 或 height。
                    selPersonalizationWindowShell.classList.add("selwindow-window-motion-preview");
                });
            }
            // 设置界面同步当前强度、开关和预设选中态。
            selPersonalizationSyncPanel();
            // 页面级事件供窗口或未来皮肤读取当前强度，不暴露可变内部对象。
            document.dispatchEvent(new CustomEvent("selPersonalization:change", {
                detail: selFreeze({ ...selPersonalizationPanelState })
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
            // 减少动态开启后禁用两个动效滑杆，明确表达它们当前不会作用于页面。
            ["windowMotion", "glowMotion"].forEach((selPersonalizationMotionKey) => {
                const selPersonalizationMotionRange = selPersonalizationControl.querySelector(`[data-sel-personal-panel-range="${selPersonalizationMotionKey}"]`);
                if (selPersonalizationMotionRange) {
                    // disabled 同时阻止键盘和指针继续修改被总开关覆盖的参数。
                    selPersonalizationMotionRange.disabled = selPersonalizationPanelState.reducedMotion;
                    selPersonalizationMotionRange.setAttribute("aria-disabled", String(selPersonalizationPanelState.reducedMotion));
                }
            });
            // 颜色输入始终显示当前有效颜色；输出区分自定义色与跟随皮肤状态。
            const selPersonalizationThemeColorInput = selPersonalizationControl.querySelector("[data-sel-personal-theme-color]");
            const selPersonalizationThemeColorOutput = selPersonalizationControl.querySelector("[data-sel-personal-theme-color-output]");
            const selPersonalizationEffectiveColor = selPersonalizationNormalizeColor(selPersonalizationPanelState.themeColor)
                || selPersonalizationResolveThemeColor()?.color
                || selPersonalizationReadSkinColor(selPersonalizationDocumentRoot);
            if (selPersonalizationThemeColorInput) {
                selPersonalizationThemeColorInput.value = selPersonalizationEffectiveColor;
            }
            if (selPersonalizationThemeColorOutput) {
                selPersonalizationThemeColorOutput.value = selPersonalizationPanelState.themeColor
                    ? selPersonalizationEffectiveColor
                    : selPersonalizationPanelState.themeAccent
                        ? selPersonalizationTranslate(selPersonalizationResolveThemeColor()?.label || "主题配色")
                        : selPersonalizationTranslate("跟随主题");
            }
            // 跟随按钮和常用色按钮同步当前颜色来源及精确选中态。
            selPersonalizationControl.querySelector("[data-sel-personal-theme-follow]")?.setAttribute("aria-pressed", String(!selPersonalizationPanelState.themeAccent && !selPersonalizationPanelState.themeColor));
            // 色板的深浅行选中态由皮肤同步函数统一计算，避免同一颜色在两行同时点亮。
            selPersonalizationSyncSkin();
            // 预设按钮只标记当前匹配的预设或自定义状态。
            selPersonalizationPresetGrid.querySelectorAll("[data-sel-personal-preset]").forEach((selPersonalizationPresetButton) => {
                selPersonalizationPresetButton.setAttribute("aria-pressed", String(selPersonalizationPresetButton.dataset.selPersonalPreset === selPersonalizationPanelState.preset));
            });
        }

        /**
         * 把文字模式、颜色、对比与字号写入页面统一文字令牌。
         * @returns {void} 只改变当前页面显示，并同步文字设置控件。
         */
        function selPersonalizationApplyText() {
            // 当前模式只能来自固定模式清单，未知值安全恢复为跟随皮肤。
            const selPersonalizationTextMode = selPersonalizationTextModes.find((selPersonalizationItem) => selPersonalizationItem.id === selPersonalizationTextState.mode) || selPersonalizationTextModes[0];
            // 非自定义模式读取当前皮肤对应参数；跟随模式的 null 颜色表示直接读取皮肤令牌。
            const selPersonalizationTextModeValues = selPersonalizationTextMode.values?.[selPersonalizationSkinState] || null;
            let selPersonalizationMainColor = selPersonalizationTextMode.id === "custom" ? selPersonalizationNormalizeColor(selPersonalizationTextState.mainColor) : selPersonalizationTextModeValues?.mainColor;
            let selPersonalizationMutedColor = selPersonalizationTextMode.id === "custom" ? selPersonalizationNormalizeColor(selPersonalizationTextState.mutedColor) : selPersonalizationTextModeValues?.mutedColor;
            // 跟随皮肤先清除所有文字色覆盖，再读取深浅皮肤真正提供的颜色供控件显示。
            if (selPersonalizationTextMode.id === "follow") {
                ["--sel-theme-text-main", "--sel-theme-text-muted", "--sel-theme-text-shadow-rgb"].forEach((selPersonalizationToken) => selPersonalizationDocumentRoot.style.removeProperty(selPersonalizationToken));
                const selPersonalizationSkinStyles = getComputedStyle(selPersonalizationDocumentRoot);
                selPersonalizationMainColor = selPersonalizationNormalizeColor(selPersonalizationSkinStyles.getPropertyValue("--sel-theme-text-main").trim());
                selPersonalizationMutedColor = selPersonalizationNormalizeColor(selPersonalizationSkinStyles.getPropertyValue("--sel-theme-text-muted").trim());
            } else if (selPersonalizationMainColor && selPersonalizationMutedColor) {
                // 主文字和次级文字分别写入统一令牌，所有业务组件从同一来源消费。
                selPersonalizationDocumentRoot.style.setProperty("--sel-theme-text-main", selPersonalizationMainColor);
                selPersonalizationDocumentRoot.style.setProperty("--sel-theme-text-muted", selPersonalizationMutedColor);
                // 标题、正文、弱化、禁用和占位色继续由主题文件从两个基础色自动派生，不在脚本复制第二套比例。
                // 深色文字使用浅色微阴影，浅色文字使用深色微阴影，避免复杂背景吞字。
                const selPersonalizationMainRgb = selPersonalizationColorToRgb(selPersonalizationMainColor).split(" ").map(Number);
                const selPersonalizationLuminance = ((selPersonalizationMainRgb[0] * 299) + (selPersonalizationMainRgb[1] * 587) + (selPersonalizationMainRgb[2] * 114)) / 1000;
                selPersonalizationDocumentRoot.style.setProperty("--sel-theme-text-shadow-rgb", selPersonalizationLuminance < 145 ? "255 255 255" : "0 0 0");
            }
            // 自定义颜色模式和已被用户单独调整的滑杆保留当前值；其余参数继续跟随当前皮肤的模式预设。
            const selPersonalizationContrast = selPersonalizationTextMode.id === "custom" || selPersonalizationTextState.contrastOverride
                ? selPersonalizationTextState.contrast
                : selPersonalizationTextModeValues.contrast;
            const selPersonalizationFontScale = selPersonalizationTextMode.id === "custom" || selPersonalizationTextState.fontScaleOverride
                ? selPersonalizationTextState.fontScale
                : selPersonalizationTextModeValues.fontScale;
            // 状态始终保存界面当前真实值，切到自定义时不会跳回上一套皮肤颜色。
            selPersonalizationTextState = {
                ...selPersonalizationTextState,
                mode: selPersonalizationTextMode.id,
                mainColor: selPersonalizationMainColor,
                mutedColor: selPersonalizationMutedColor,
                contrast: selPersonalizationContrast,
                fontScale: selPersonalizationFontScale
            };
            // 对比强度映射到 0 至 0.28 的阴影透明度，不改变文字本身颜色。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-text-contrast-alpha", String(selPersonalizationMap(selPersonalizationContrast, 0, 0.28)));
            // 字号滑杆 0、50、100 分别映射为 0.8、1、1.2，默认视觉不跳变。
            selPersonalizationDocumentRoot.style.setProperty("--sel-theme-font-scale", String(selPersonalizationMap(selPersonalizationFontScale, 0.8, 1.2)));
            // 根状态仅供视觉规则识别模式，不承担持久化。
            selPersonalizationDocumentRoot.dataset.selPersonalTextMode = selPersonalizationTextMode.id;
            // 设置界面和页面预览在同一帧同步。
            selPersonalizationSyncText();
            // 独立事件让未来组件按需读取文字状态而不耦合内部变量。
            document.dispatchEvent(new CustomEvent("selPersonalization:text-change", { detail: selFreeze({ ...selPersonalizationTextState }) }));
        }

        /**
         * 同步文字模式按钮、颜色输入、滑杆输出和局部预览。
         * @returns {void} 只更新设置控件，不重复写页面令牌。
         */
        function selPersonalizationSyncText() {
            // 模式按钮通过 aria-pressed 表达唯一选中项。
            selPersonalizationTextModeGrid.querySelectorAll("[data-sel-personal-text-mode]").forEach((selPersonalizationTextModeButton) => {
                selPersonalizationTextModeButton.setAttribute("aria-pressed", String(selPersonalizationTextModeButton.dataset.selPersonalTextMode === selPersonalizationTextState.mode));
            });
            // 两个颜色输入显示当前模式在当前皮肤中的真实颜色，浅色跟随模式不再显示深色白字。
            ["mainColor", "mutedColor"].forEach((selPersonalizationColorKey) => {
                const selPersonalizationColorInput = selPersonalizationControl.querySelector(`[data-sel-personal-text-color="${selPersonalizationColorKey}"]`);
                const selPersonalizationColorOutput = selPersonalizationControl.querySelector(`[data-sel-personal-text-color-output="${selPersonalizationColorKey}"]`);
                if (selPersonalizationColorInput) selPersonalizationColorInput.value = selPersonalizationTextState[selPersonalizationColorKey];
                if (selPersonalizationColorOutput) selPersonalizationColorOutput.value = selPersonalizationTextState[selPersonalizationColorKey];
            });
            // 对比输出显示用户尺度，字号输出显示实际 80% 至 120% 结果。
            ["contrast", "fontScale"].forEach((selPersonalizationTextKey) => {
                const selPersonalizationTextRange = selPersonalizationControl.querySelector(`[data-sel-personal-text-range="${selPersonalizationTextKey}"]`);
                const selPersonalizationTextOutput = selPersonalizationControl.querySelector(`[data-sel-personal-text-output="${selPersonalizationTextKey}"]`);
                if (selPersonalizationTextRange) selPersonalizationTextRange.value = String(selPersonalizationTextState[selPersonalizationTextKey]);
                if (selPersonalizationTextOutput) selPersonalizationTextOutput.value = selPersonalizationTextKey === "fontScale" ? `${Math.round(selPersonalizationMap(selPersonalizationTextState.fontScale, 80, 120))}%` : `${selPersonalizationTextState.contrast}%`;
            });
        }

        // 外观区域记住当前子页，用户和页面编辑往返时不把主题页强制重置。
        let selPersonalizationAppearanceView = "skin";

        /** 切换设置中心一级区域，顶部数量保持固定，不随未来模块数量增长。 */
        function selPersonalizationSelectArea(selPersonalizationAreaName) {
            if (!["appearance", "user", "page"].includes(selPersonalizationAreaName)) return false;
            if (selPersonalizationAreaName === "page" && !selPersonalizationPageEditorAllowed) return false;
            selPersonalizationControl.querySelectorAll("[data-sel-personal-area]").forEach((selPersonalizationAreaButton) => {
                const selPersonalizationSelected = selPersonalizationAreaButton.dataset.selPersonalArea === selPersonalizationAreaName;
                selPersonalizationAreaButton.classList.toggle("selpersonal-area-selected", selPersonalizationSelected);
                selPersonalizationAreaButton.setAttribute("aria-selected", String(selPersonalizationSelected));
            });
            selPersonalizationControl.querySelectorAll("[data-sel-personal-area-panel]").forEach((selPersonalizationAreaPanel) => {
                selPersonalizationAreaPanel.hidden = selPersonalizationAreaPanel.dataset.selPersonalAreaPanel !== selPersonalizationAreaName;
            });
            if (selPersonalizationAreaName === "appearance") selPersonalizationSelectView(selPersonalizationAppearanceView, false);
            if (selPersonalizationAreaName === "user") selPersonalizationSelectView("language", false);
            return true;
        }

        /**
         * 切换当前区域中的设置视图。
         * @param {string} selPersonalizationViewName - skin、background、panel、text 或 language。
         * @param {boolean} selPersonalizationSyncArea - 是否同步对应一级区域。
         * @returns {boolean} 成功切换时返回 true。
         */
        function selPersonalizationSelectView(selPersonalizationViewName, selPersonalizationSyncArea = true) {
            // 未知视图不会隐藏当前有效界面。
            if (!["skin", "background", "panel", "text", "language"].includes(selPersonalizationViewName)) {
                return false;
            }
            const selPersonalizationTargetArea = selPersonalizationViewName === "language" ? "user" : "appearance";
            if (selPersonalizationTargetArea === "appearance") selPersonalizationAppearanceView = selPersonalizationViewName;
            if (selPersonalizationSyncArea) selPersonalizationSelectArea(selPersonalizationTargetArea);
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

        // 面板打开、关闭、外部点击、Escape 与焦点归还统一由 selFloatingPanel 处理。
        // 一级区域委托保持三个稳定入口；未来模块只进入各自区域内容。
        selPersonalizationControl.querySelector(".selpersonal-areas")?.addEventListener("click", (selPersonalizationEvent) => {
            const selPersonalizationArea = selPersonalizationEvent.target.closest("[data-sel-personal-area]");
            if (selPersonalizationArea) selPersonalizationSelectArea(selPersonalizationArea.dataset.selPersonalArea);
        });
        // 一级区域支持方向键和首尾键，页面编辑不会因未来模块增多而破坏键盘顺序。
        selPersonalizationControl.querySelector(".selpersonal-areas")?.addEventListener("keydown", (selPersonalizationEvent) => {
            const selPersonalizationAreas = Array.from(selPersonalizationControl.querySelectorAll("[data-sel-personal-area]"));
            const selPersonalizationCurrentAreaIndex = selPersonalizationAreas.indexOf(selPersonalizationEvent.target);
            if (selPersonalizationCurrentAreaIndex < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(selPersonalizationEvent.key)) return;
            selPersonalizationEvent.preventDefault();
            const selPersonalizationNextAreaIndex = selPersonalizationEvent.key === "Home"
                ? 0
                : selPersonalizationEvent.key === "End"
                    ? selPersonalizationAreas.length - 1
                    : (selPersonalizationCurrentAreaIndex + (selPersonalizationEvent.key === "ArrowRight" ? 1 : -1) + selPersonalizationAreas.length) % selPersonalizationAreas.length;
            selPersonalizationAreas[selPersonalizationNextAreaIndex].focus();
            selPersonalizationSelectArea(selPersonalizationAreas[selPersonalizationNextAreaIndex].dataset.selPersonalArea);
        });
        // 每个区域内部的 tablist 独立切换当前子页。
        selPersonalizationControl.querySelectorAll(".selpersonal-tabs").forEach((selPersonalizationTabs) => {
            selPersonalizationTabs.addEventListener("click", (selPersonalizationEvent) => {
                const selPersonalizationTab = selPersonalizationEvent.target.closest("[data-sel-personal-tab]");
                if (selPersonalizationTab) selPersonalizationSelectView(selPersonalizationTab.dataset.selPersonalTab);
            });
        });
        // 语言选择只把稳定 BCP-47 值交回应用装配层；公共组件不拼接项目配置路径。
        selPersonalizationLanguageGrid.addEventListener("click", (selPersonalizationEvent) => {
            const selPersonalizationLanguageButton = selPersonalizationEvent.target.closest("[data-sel-personal-language]");
            if (!selPersonalizationLanguageButton || selPersonalizationLanguageButton.dataset.selPersonalLanguage === selPersonalizationLocale) return;
            const selPersonalizationRequestedLocale = selPersonalizationLanguageButton.dataset.selPersonalLanguage;
            const selPersonalizationLocaleKnown = selPersonalizationLanguageOptions.some((selPersonalizationLanguage) => selPersonalizationLanguage.value === selPersonalizationRequestedLocale);
            if (!selPersonalizationLocaleKnown || typeof selPersonalizationOptions.locale?.onChange !== "function") return;
            selPersonalizationOptions.locale.onChange(selPersonalizationRequestedLocale);
        });
        // 每组 tablist 独立支持方向键和首尾键，隐藏区域不会进入当前键盘循环。
        selPersonalizationControl.querySelectorAll(".selpersonal-tabs").forEach((selPersonalizationTabList) => selPersonalizationTabList.addEventListener("keydown", (selPersonalizationEvent) => {
            const selPersonalizationTabs = Array.from(selPersonalizationTabList.querySelectorAll("[data-sel-personal-tab]"));
            // 只有焦点位于 tab 时才处理分类导航按键。
            const selPersonalizationCurrentIndex = selPersonalizationTabs.indexOf(selPersonalizationEvent.target);
            if (selPersonalizationCurrentIndex < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(selPersonalizationEvent.key)) {
                return;
            }
            // 阻止方向键滚动浮层内容。
            selPersonalizationEvent.preventDefault();
            // Home 和 End 直达首尾；左右方向在五个一级设置之间循环。
            const selPersonalizationNextIndex = selPersonalizationEvent.key === "Home"
                ? 0
                : selPersonalizationEvent.key === "End"
                    ? selPersonalizationTabs.length - 1
                    : (selPersonalizationCurrentIndex + (selPersonalizationEvent.key === "ArrowRight" ? 1 : -1) + selPersonalizationTabs.length) % selPersonalizationTabs.length;
            // 焦点和选中视图同步移动。
            selPersonalizationTabs[selPersonalizationNextIndex].focus();
            selPersonalizationSelectView(selPersonalizationTabs[selPersonalizationNextIndex].dataset.selPersonalTab);
        }));

        /** 在主题首页和独立主题库子页面之间切换，不改变主题、模式或筛选状态。 */
        function selPersonalizationSetThemeLibraryOpen(selPersonalizationOpen) {
            const selPersonalizationThemeLibraryOpen = Boolean(selPersonalizationOpen);
            selPersonalizationThemeHome.hidden = selPersonalizationThemeLibraryOpen;
            selPersonalizationThemeLibrary.hidden = !selPersonalizationThemeLibraryOpen;
            selPersonalizationThemeLibraryToggle.setAttribute("aria-expanded", String(selPersonalizationThemeLibraryOpen));
            if (selPersonalizationThemeLibraryOpen) {
                selPersonalizationThemeSearch.focus({ preventScroll: true });
            } else {
                window.sel.components.dropdownMenu?.close(selPersonalizationThemeCategoryRoot);
                selPersonalizationThemeLibraryToggle.focus({ preventScroll: true });
            }
        }

        // 当前主题、最近使用和主题库共享同一切换路径，新增主题无需增加事件分支。
        selPersonalizationControl.querySelector("[data-sel-personal-view='skin']")?.addEventListener("click", (selPersonalizationEvent) => {
            const selPersonalizationThemeButton = selPersonalizationEvent.target.closest("[data-sel-personal-theme]");
            if (!selPersonalizationThemeButton || !selPersonalizationThemeManager.setTheme(selPersonalizationThemeButton.dataset.selPersonalTheme)) {
                return;
            }
            // 记录点击是否来自完整主题库；重绘会替换原按钮，必须在重绘前取得来源。
            const selPersonalizationThemeSelectedFromLibrary = selPersonalizationThemeGrid.contains(selPersonalizationThemeButton);
            selPersonalizationThemeState = selPersonalizationThemeManager.getState().theme;
            selPersonalizationActiveTheme = selPersonalizationThemeManager.getTheme();
            selPersonalizationSkins = selPersonalizationActiveTheme.modes;
            // 每套主题拥有自己的默认模式；恢复主题时不得沿用首次加载主题的默认值。
            selPersonalizationDefaultSkin = selPersonalizationActiveTheme.defaults?.mode || selPersonalizationSkins[0]?.id || "dark";
            selPersonalizationSkinState = selPersonalizationThemeManager.getState().mode;
            selPersonalizationPanelState = {
                ...selPersonalizationPanelState,
                themeAccent: selPersonalizationThemeManager.getState().accent,
                themeColor: null,
                preset: "custom"
            };
            // 新选择移到最近使用首位，最多保留四个主题且不落盘。
            selPersonalizationRecentThemeIds = [selPersonalizationThemeState, ...selPersonalizationRecentThemeIds]
                .filter((selPersonalizationThemeId, selPersonalizationThemeIndex, selPersonalizationThemeIds) => selPersonalizationThemeIds.indexOf(selPersonalizationThemeId) === selPersonalizationThemeIndex)
                .slice(0, 4);
            selPersonalizationRenderThemeOptions();
            selPersonalizationApplySkin(selPersonalizationSkinState);
            selPersonalizationApplyPanel();
            selPersonalizationApplyText();
            // 从主题库完成选择后回到主题首页，继续选择该主题的深浅模式与七套皮肤。
            if (selPersonalizationThemeSelectedFromLibrary) selPersonalizationSetThemeLibraryOpen(false);
        });
        // 更换主题进入独立全高主题库，返回按钮恢复主题首页。
        selPersonalizationThemeLibraryToggle.addEventListener("click", () => selPersonalizationSetThemeLibraryOpen(true));
        selPersonalizationThemeLibraryBack.addEventListener("click", () => selPersonalizationSetThemeLibraryOpen(false));
        // 搜索与分类只过滤主题库，不影响当前主题和最近使用快捷入口。
        selPersonalizationThemeSearch.addEventListener("input", selPersonalizationFilterThemeLibrary);
        selPersonalizationThemeCategory.addEventListener("change", selPersonalizationFilterThemeLibrary);
        // 皮肤预览卡同步当前主题的明暗模式和配套背景；面板强度与文字显式覆盖保持原状态。
        selPersonalizationSkinGrid.addEventListener("click", (selPersonalizationEvent) => {
            const selPersonalizationSkinButton = selPersonalizationEvent.target.closest("[data-sel-personal-skin]");
            if (!selPersonalizationSkinButton || !selPersonalizationApplySkin(selPersonalizationSkinButton.dataset.selPersonalSkin)) {
                return;
            }
            // 跟随皮肤的主题色和文字必须重新读取新皮肤；自定义值会由各自状态继续覆盖。
            selPersonalizationApplyPanel();
            selPersonalizationApplyText();
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
                    // 当前 input.max 来自固定配置，因此内板比例允许 150，其他控件仍封顶 100。
                    [selPersonalizationKey]: selPersonalizationClamp(selPersonalizationRange.value, selPersonalizationDefaults[selPersonalizationKey], Number(selPersonalizationRange.max || 100)),
                    preset: "custom"
                };
                // 新状态即时作用于所有水晶组件。
                selPersonalizationApplyPanel(selPersonalizationKey);
            });
        });
        // 文字模式按钮实时切换当前皮肤对应的完整文字预设；直接进入自定义时沿用当前真实值。
        selPersonalizationTextModeGrid.addEventListener("click", (selPersonalizationEvent) => {
            // 只响应固定模式按钮，空白区域不改变状态。
            const selPersonalizationTextModeButton = selPersonalizationEvent.target.closest("[data-sel-personal-text-mode]");
            if (!selPersonalizationTextModeButton) return;
            // 选择正式模式时恢复其分肤对比与字号；自定义入口继续承接当前页面已经显示的参数。
            const selPersonalizationRequestedTextMode = selPersonalizationTextModeButton.dataset.selPersonalTextMode;
            const selPersonalizationKeepRangeOverrides = selPersonalizationRequestedTextMode === "custom";
            selPersonalizationTextState = {
                ...selPersonalizationTextState,
                mode: selPersonalizationRequestedTextMode,
                contrastOverride: selPersonalizationKeepRangeOverrides && selPersonalizationTextState.contrastOverride,
                fontScaleOverride: selPersonalizationKeepRangeOverrides && selPersonalizationTextState.fontScaleOverride
            };
            selPersonalizationApplyText();
        });
        // 编辑任一文字颜色会明确进入自定义模式，避免预设色覆盖用户选择。
        selPersonalizationControl.querySelectorAll("[data-sel-personal-text-color]").forEach((selPersonalizationColorInput) => {
            selPersonalizationColorInput.addEventListener("input", () => {
                // 数据键只可能是主文字或次级文字颜色。
                const selPersonalizationColorKey = selPersonalizationColorInput.dataset.selPersonalTextColor;
                // 合法原生颜色值写入当前页面内存。
                selPersonalizationTextState = { ...selPersonalizationTextState, [selPersonalizationColorKey]: selPersonalizationNormalizeColor(selPersonalizationColorInput.value), mode: "custom" };
                selPersonalizationApplyText();
            });
        });
        // 文字对比和字号都使用 input 事件，拖动过程逐帧可见且不改变当前颜色模式。
        selPersonalizationControl.querySelectorAll("[data-sel-personal-text-range]").forEach((selPersonalizationTextRange) => {
            selPersonalizationTextRange.addEventListener("input", () => {
                // 固定数据键对应文字状态中的百分比字段。
                const selPersonalizationTextKey = selPersonalizationTextRange.dataset.selPersonalTextRange;
                // 滑杆只覆盖自己的参数；颜色仍保持跟随、柔和、清晰或自定义，换肤时不会遗留上一套文字色。
                const selPersonalizationTextOverrideKey = `${selPersonalizationTextKey}Override`;
                selPersonalizationTextState = {
                    ...selPersonalizationTextState,
                    [selPersonalizationTextKey]: selPersonalizationClamp(selPersonalizationTextRange.value, selPersonalizationTextDefaults[selPersonalizationTextKey]),
                    [selPersonalizationTextOverrideKey]: true
                };
                selPersonalizationApplyText();
            });
        });
        // 原生颜色输入允许用户选择色板之外的任意统一主题色。
        selPersonalizationControl.querySelector("[data-sel-personal-theme-color]")?.addEventListener("input", (selPersonalizationEvent) => {
            // 合法颜色进入当前页面自定义状态。
            selPersonalizationPanelState = { ...selPersonalizationPanelState, themeAccent: null, themeColor: selPersonalizationNormalizeColor(selPersonalizationEvent.target.value), preset: "custom" };
            // 拖动取色器期间只更新边框和颜色令牌，避免反复解码背景造成指针延迟。
            selPersonalizationApplyThemeAssets(false);
            // 新颜色即时覆盖所有水晶组件的共享主题变量。
            selPersonalizationApplyPanel();
        });
        // 原生取色结束后再一次性同步背景；正式色板命中配套图，其他颜色回到皮肤默认背景。
        selPersonalizationControl.querySelector("[data-sel-personal-theme-color]")?.addEventListener("change", () => {
            selPersonalizationApplyThemeAssets(true);
            selPersonalizationApplyPanel();
        });
        // 跟随皮肤按钮清除临时颜色覆盖，不改变其他面板强度。
        selPersonalizationControl.querySelector("[data-sel-personal-theme-follow]")?.addEventListener("click", () => {
            // null 让 CSS 重新读取皮肤默认主题色。
            selPersonalizationPanelState = { ...selPersonalizationPanelState, themeAccent: null, themeColor: null, preset: "custom" };
            // 立即恢复当前皮肤颜色、原始边框和配套背景。
            selPersonalizationApplyThemeAssets(true);
            selPersonalizationApplyPanel();
        });
        // 配色入口同时切换目标模式与素材；基础入口清除临时颜色并恢复当前主题原始资源。
        selPersonalizationControl.querySelector("[data-sel-personal-skin-themes]")?.addEventListener("click", (selPersonalizationEvent) => {
            // 只响应带颜色数据的原生按钮。
            const selPersonalizationSwatch = selPersonalizationEvent.target.closest("[data-sel-personal-theme-swatch]");
            if (!selPersonalizationSwatch) {
                return;
            }
            // 在换肤前先写入目标主题来源，避免皮肤切换瞬间短暂应用上一套颜色素材。
            const selPersonalizationBaseTheme = selPersonalizationSwatch.dataset.selPersonalThemeBase === "true";
            const selPersonalizationRequestedAccent = selPersonalizationBaseTheme
                ? null
                : selPersonalizationSwatch.dataset.selPersonalThemeAccent;
            selPersonalizationPanelState = { ...selPersonalizationPanelState, themeAccent: selPersonalizationRequestedAccent, themeColor: null, preset: "custom" };
            // 再切换到按钮所属明暗皮肤，基础入口会直接解析原始边框和背景。
            if (!selPersonalizationApplySkin(selPersonalizationSwatch.dataset.selPersonalThemeSkin)) {
                return;
            }
            // 基础水晶或正式色板都作为完整主题包同步边框、背景和统一颜色令牌。
            selPersonalizationApplyThemeAssets(true);
            // 所有共享水晶表面即时响应。
            selPersonalizationApplyPanel();
            selPersonalizationApplyText();
        });
        // 减少动态效果开关关闭所有窗口动画和光效流动。
        selPersonalizationControl.querySelector("[data-sel-personal-reduced-motion]")?.addEventListener("change", (selPersonalizationEvent) => {
            // 开关状态与自定义预设一起保存到当前页面内存。
            selPersonalizationPanelState = { ...selPersonalizationPanelState, reducedMotion: selPersonalizationEvent.target.checked, preset: "custom" };
            // 页面根标识立即触发动效降级规则。
            selPersonalizationApplyPanel();
        });
        // 预设按钮一次应用当前皮肤对应的一组强度值。
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
            // 深浅皮肤读取各自参数组，避免浅色沿用高染色、高发光的深色数值。
            const selPersonalizationPresetValues = selPersonalizationPreset.values?.[selPersonalizationSkinState];
            selPersonalizationPanelState = selPersonalizationPresetValues
                ? { ...selPersonalizationPanelState, ...selPersonalizationPresetValues, preset: selPersonalizationPreset.id }
                : { ...selPersonalizationPanelState, preset: "custom" };
            // 预设结果立即作用于页面。
            selPersonalizationApplyPanel();
        });
        // 背景恢复按钮采用当前皮肤的配套背景，不再把浅色皮肤恢复成深色显示参数。
        selPersonalizationControl.querySelector("[data-sel-personal-action='reset-background']")?.addEventListener("click", () => {
            // 当前色板存在时恢复它的配套背景；跟随或自定义颜色恢复当前皮肤默认背景。
            selPersonalizationApplyThemeAssets(true);
        });
        // 主题恢复回到当前 manifest 声明的默认模式，不改变其他三个 Tab 的当前状态。
        selPersonalizationControl.querySelector("[data-sel-personal-action='reset-skin']")?.addEventListener("click", () => {
            selPersonalizationApplySkin(selPersonalizationDefaultSkin);
            selPersonalizationApplyPanel();
            selPersonalizationApplyText();
        });
        // 面板恢复按钮重新使用本次挂载的刷新默认值。
        selPersonalizationControl.querySelector("[data-sel-personal-action='reset-panel']")?.addEventListener("click", () => {
            // 默认状态只来自代码配置，不读取本地缓存。
            selPersonalizationPanelState = { ...selPersonalizationDefaults, themeColor: selPersonalizationNormalizeColor(selPersonalizationDefaults.themeColor), reducedMotion: Boolean(selPersonalizationDefaults.reducedMotion) };
            // 默认面板令牌与当前皮肤配套素材立即写回页面。
            selPersonalizationApplyThemeAssets(true);
            selPersonalizationApplyPanel();
        });
        // 文字恢复按钮只重置文字体系，不改变背景主题或面板参数。
        selPersonalizationControl.querySelector("[data-sel-personal-action='reset-text']")?.addEventListener("click", () => {
            // 默认值来自代码常量，刷新与手动恢复得到同一结果。
            selPersonalizationTextState = { ...selPersonalizationTextDefaults };
            selPersonalizationApplyText();
        });
        // 背景模块从其他公开入口变化时，组合界面同步状态。
        document.addEventListener("selPageBackground:change", selPersonalizationSyncBackground);

        /**
         * 恢复一次语言切换前的当前页面视觉快照；所有字段仍经过现有注册表和范围校验。
         * @param {object} selPersonalizationSnapshot - getState 返回的主题、背景、面板、文字和浮层状态。
         * @returns {boolean} 快照结构合法并已应用时返回 true。
         */
        function selPersonalizationRestoreState(selPersonalizationSnapshot = {}) {
            if (!selPersonalizationSnapshot || typeof selPersonalizationSnapshot !== "object") return false;

            // 主题必须来自注册表按钮；复用真实点击路径以同步当前主题的模式清单和素材配置。
            const selPersonalizationRequestedTheme = String(selPersonalizationSnapshot.theme || "");
            const selPersonalizationRequestedThemeKnown = selPersonalizationThemes.some((selPersonalizationTheme) => selPersonalizationTheme.id === selPersonalizationRequestedTheme);
            const selPersonalizationRequestedThemeButton = selPersonalizationRequestedThemeKnown
                ? selPersonalizationThemeGrid.querySelector(`[data-sel-personal-theme="${CSS.escape(selPersonalizationRequestedTheme)}"]`)
                : null;
            if (selPersonalizationRequestedThemeButton && selPersonalizationRequestedTheme !== selPersonalizationThemeState) {
                selPersonalizationRequestedThemeButton.click();
            }
            // 模式必须属于恢复后的当前主题，未知值继续保留该主题安全默认值。
            const selPersonalizationRequestedMode = String(selPersonalizationSnapshot.mode || selPersonalizationSnapshot.skin || "");
            if (selPersonalizationSkins.some((selPersonalizationSkin) => selPersonalizationSkin.id === selPersonalizationRequestedMode)) {
                selPersonalizationApplySkin(selPersonalizationRequestedMode);
            }

            // 面板滑杆逐项按各自最大值夹取，禁止瞬时状态绕过公共控件范围。
            const selPersonalizationRequestedPanel = selPersonalizationSnapshot.panel && typeof selPersonalizationSnapshot.panel === "object"
                ? selPersonalizationSnapshot.panel
                : {};
            const selPersonalizationRestoredPanel = { ...selPersonalizationPanelState };
            selPersonalizationPanelRangeGroups.flatMap((selPersonalizationGroup) => selPersonalizationGroup.items).forEach((selPersonalizationItem) => {
                selPersonalizationRestoredPanel[selPersonalizationItem.key] = selPersonalizationClamp(
                    selPersonalizationRequestedPanel[selPersonalizationItem.key],
                    selPersonalizationRestoredPanel[selPersonalizationItem.key],
                    selPersonalizationItem.maximum || 100
                );
            });
            const selPersonalizationRestoredColor = selPersonalizationNormalizeColor(selPersonalizationRequestedPanel.themeColor);
            const selPersonalizationCurrentSkin = selPersonalizationSkins.find((selPersonalizationSkin) => selPersonalizationSkin.id === selPersonalizationSkinState);
            const selPersonalizationRestoredAccent = selPersonalizationCurrentSkin?.accents.some((selPersonalizationAccent) => selPersonalizationAccent.id === selPersonalizationRequestedPanel.themeAccent)
                ? selPersonalizationRequestedPanel.themeAccent
                : null;
            selPersonalizationRestoredPanel.themeColor = selPersonalizationRestoredColor;
            selPersonalizationRestoredPanel.themeAccent = selPersonalizationRestoredColor ? null : selPersonalizationRestoredAccent;
            selPersonalizationRestoredPanel.reducedMotion = Boolean(selPersonalizationRequestedPanel.reducedMotion);
            selPersonalizationRestoredPanel.preset = selPersonalizationPresets.some((selPersonalizationPreset) => selPersonalizationPreset.id === selPersonalizationRequestedPanel.preset)
                ? selPersonalizationRequestedPanel.preset
                : "custom";
            selPersonalizationPanelState = selPersonalizationRestoredPanel;

            // 文字模式与颜色分别校验；对比和字号继续使用现有 0 至 100 业务范围。
            const selPersonalizationRequestedText = selPersonalizationSnapshot.text && typeof selPersonalizationSnapshot.text === "object"
                ? selPersonalizationSnapshot.text
                : {};
            const selPersonalizationRestoredTextMode = selPersonalizationTextModes.some((selPersonalizationMode) => selPersonalizationMode.id === selPersonalizationRequestedText.mode)
                ? selPersonalizationRequestedText.mode
                : selPersonalizationTextDefaults.mode;
            selPersonalizationTextState = {
                mode: selPersonalizationRestoredTextMode,
                mainColor: selPersonalizationNormalizeColor(selPersonalizationRequestedText.mainColor),
                mutedColor: selPersonalizationNormalizeColor(selPersonalizationRequestedText.mutedColor),
                contrast: selPersonalizationClamp(selPersonalizationRequestedText.contrast, selPersonalizationTextDefaults.contrast),
                fontScale: selPersonalizationClamp(selPersonalizationRequestedText.fontScale, selPersonalizationTextDefaults.fontScale),
                contrastOverride: Boolean(selPersonalizationRequestedText.contrastOverride),
                fontScaleOverride: Boolean(selPersonalizationRequestedText.fontScaleOverride)
            };

            // 先恢复主题令牌与文字，再显式恢复用户独立选择的背景，防止主题配套背景覆盖它。
            selPersonalizationApplyPanel();
            selPersonalizationApplyText();
            const selPersonalizationRequestedBackground = selPersonalizationSnapshot.background && typeof selPersonalizationSnapshot.background === "object"
                ? selPersonalizationSnapshot.background
                : {};
            if (selPersonalizationRequestedBackground.theme) {
                selPersonalizationBackgroundController.setTheme(selPersonalizationRequestedBackground.theme);
            }
            selPersonalizationBackgroundController.setDisplay(selPersonalizationRequestedBackground);
            selPersonalizationSyncBackground();

            // 浮层尺寸、当前页签和打开状态同样属于本次页面视觉，但不会写入任何长期存储。
            if (selPersonalizationSnapshot.floating?.customized) {
                selPersonalizationFloatingPanel.setSize(selPersonalizationSnapshot.floating);
            } else {
                selPersonalizationFloatingPanel.resetSize();
            }
            if (["skin", "background", "panel", "text", "language"].includes(selPersonalizationSnapshot.view)) {
                selPersonalizationSelectView(selPersonalizationSnapshot.view);
            }
            if (["appearance", "user", "page"].includes(selPersonalizationSnapshot.area)) {
                selPersonalizationSelectArea(selPersonalizationSnapshot.area);
            }
            if (selPersonalizationSnapshot.open) selPersonalizationFloatingPanel.open();
            return true;
        }

        /**
         * 原位切换公共组件语言；主题、面板参数、当前标签、打开状态和拖拽尺寸均保持同一实例。
         * @param {{locale:string,resource:object}} selPersonalizationNext - 统一语言管理器准备好的公共文案。
         * @returns {boolean} 文案结构有效并已更新时返回 true。
         */
        function selPersonalizationSetLocale(selPersonalizationNext = {}) {
            const selPersonalizationNextMessages = selPersonalizationNext.resource || selPersonalizationNext.messages;
            const selPersonalizationNextLocale = String(selPersonalizationNext.locale || selPersonalizationNextMessages?.locale || "");
            if (!selPersonalizationNextLocale || !selPersonalizationNextMessages || typeof selPersonalizationNextMessages !== "object") return false;
            const selPersonalizationPreviousTextMap = selPersonalizationTextMap;
            selPersonalizationLocale = selPersonalizationNextLocale;
            selPersonalizationMessages = selPersonalizationNextMessages;
            selPersonalizationTextMap = selPersonalizationMessages.text || {};
            selPersonalizationTemplates = selPersonalizationMessages.templates || {};
            selPersonalizationLanguageOptions = Array.isArray(selPersonalizationMessages.languageOptions) ? selPersonalizationMessages.languageOptions : [];
            // 先把现有静态文字从旧语言还原到稳定源文本，再映射成新语言。
            selPersonalizationLocalizeNode(selPersonalizationControl, selPersonalizationPreviousTextMap);
            // 动态主题卡和语言卡使用新配置重绘，所有选择状态随后由内存状态重新同步。
            selPersonalizationRenderLanguageOptions();
            selPersonalizationRenderThemeOptions();
            selPersonalizationRenderExtensionModules();
            const selPersonalizationVariantCount = selPersonalizationControl.querySelector(".selpersonal-skin-theme-section .selpersonal-section-heading > small");
            const selPersonalizationBackgroundCount = selPersonalizationControl.querySelector("[data-sel-personal-view='background'] > .selpersonal-view-heading > span");
            if (selPersonalizationVariantCount) selPersonalizationVariantCount.textContent = selPersonalizationFormat("activeVariantCount", { count: 7 }, "当前模式 {count} 套");
            if (selPersonalizationBackgroundCount) selPersonalizationBackgroundCount.textContent = selPersonalizationFormat("backgroundCount", { count: selPersonalizationBackgroundController.themes.length }, "{count} 种独立主题");
            selPersonalizationApplyPanel();
            selPersonalizationApplyText();
            return true;
        }

        // 公开控制器提供当前状态、视图切换和刷新默认动作。
        const selPersonalizationController = {
            // themes 与 skins 始终返回注册表和当前主题的不可变清单。
            themes: selPersonalizationThemes,
            get skins() { return selPersonalizationSkins; },
            // presets 供应用读取可用预设清单，不暴露可变对象。
            presets: selPersonalizationPresets,
            // getState 同时返回皮肤、背景、面板与文字的不可变快照。
            getState: () => selFreeze({
                locale: selPersonalizationLocale,
                theme: selPersonalizationThemeState,
                mode: selPersonalizationSkinState,
                skin: selPersonalizationSkinState,
                background: selPersonalizationBackgroundController.getState(),
                panel: { ...selPersonalizationPanelState },
                text: { ...selPersonalizationTextState },
                floating: selPersonalizationFloatingPanel.getSize(),
                open: selPersonalizationFloatingPanel.isOpen(),
                pageEditor: {
                    canEdit: selPersonalizationPageEditorAllowed,
                    mode: selPersonalizationPageMode,
                    controlCount: selPersonalizationPageControls.size
                },
                area: selPersonalizationControl.querySelector('[data-sel-personal-area][aria-selected="true"]')?.dataset.selPersonalArea || "appearance",
                view: selPersonalizationControl.querySelector('[data-sel-personal-tab][aria-selected="true"]')?.dataset.selPersonalTab || "skin"
            }),
            // 外壳开关能力直接转交通用浮动面板，业务调用方无需访问内部 DOM。
            open: selPersonalizationFloatingPanel.open,
            close: selPersonalizationFloatingPanel.close,
            toggle: selPersonalizationFloatingPanel.toggle,
            isOpen: selPersonalizationFloatingPanel.isOpen,
            selectView: selPersonalizationSelectView,
            selectArea: selPersonalizationSelectArea,
            registerPageControl: selPersonalizationRegisterPageControl,
            updatePageControl: selPersonalizationUpdatePageControl,
            setPageMode: selPersonalizationSetPageMode,
            setLocale: selPersonalizationSetLocale,
            setSettingsSchema(selPersonalizationSettingsSchema) {
                if (!selPersonalizationSettingsRegistry?.replaceFromJson(selPersonalizationSettingsSchema)) return false;
                selPersonalizationRenderExtensionModules();
                return true;
            },
            restoreState: selPersonalizationRestoreState,
            setTheme(selPersonalizationThemeId) {
                const selPersonalizationThemeButton = selPersonalizationThemeGrid.querySelector(`[data-sel-personal-theme="${selPersonalizationThemeId}"]`);
                if (!selPersonalizationThemeButton) return false;
                selPersonalizationThemeButton.click();
                return true;
            },
            setMode(selPersonalizationModeId) {
                if (!selPersonalizationApplySkin(selPersonalizationModeId)) return false;
                selPersonalizationApplyPanel();
                selPersonalizationApplyText();
                return true;
            },
            setSkin(selPersonalizationSkinId) {
                if (!selPersonalizationApplySkin(selPersonalizationSkinId)) return false;
                selPersonalizationApplyPanel();
                selPersonalizationApplyText();
                return true;
            },
            reset() {
                // 完整重置同时恢复皮肤、背景、面板和文字刷新默认值。
                selPersonalizationApplySkin(selPersonalizationDefaultSkin);
                selPersonalizationBackgroundController.reset();
                selPersonalizationPanelState = { ...selPersonalizationDefaults, themeColor: selPersonalizationNormalizeColor(selPersonalizationDefaults.themeColor), reducedMotion: Boolean(selPersonalizationDefaults.reducedMotion) };
                selPersonalizationTextState = { ...selPersonalizationTextDefaults };
                selPersonalizationSyncBackground();
                selPersonalizationApplyPanel();
                selPersonalizationApplyText();
            }
        };
        // 保存控制器后立即同步皮肤、背景、面板与文字默认状态。
        selPersonalizationControllers.set(selPersonalizationHost, selPersonalizationController);
        selPersonalizationApplySkin(selPersonalizationSkinState);
        selPersonalizationSyncBackground();
        selPersonalizationApplyPanel();
        selPersonalizationApplyText();
        // 应用装配层只可传入本次导航从内存取得的一次性状态；恢复路径不会自行读取任何存储。
        if (selPersonalizationOptions.initialState) {
            selPersonalizationRestoreState(selPersonalizationOptions.initialState);
        }
        // 返回组合控制器供应用确认挂载成功。
        return selPersonalizationController;
    }

    // 个性化模块只注册公开能力，不主动扫描页面。
    window.sel.register("components.personalization", {
        // skins 提供正式深浅皮肤清单。
        skins: selPersonalizationSkins,
        // presets 提供标准面板预设清单。
        presets: selPersonalizationPresets,
        // scopes 与注册入口供项目在 mount 前装载后端 JSON 描述，不包含任何真实权限结论。
        scopes: selPersonalizationSettingsRegistry?.scopes || [],
        registerSettingModule: (selPersonalizationModule) => selPersonalizationSettingsRegistry?.register(selPersonalizationModule) || false,
        // mount 是创建个性化设置 UI 的唯一入口。
        mount: selPersonalizationMount,
        // get 必须指定宿主，支持同页多实例隔离。
        get: (selPersonalizationHost) => selPersonalizationControllers.get(selPersonalizationHost) || null
    });
})();
