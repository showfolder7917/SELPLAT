/*
 * desktop.js：SELPLAT 统一工作桌面装配层。
 * 应用入口来自静态 JSON；未来后端返回同一结构时只需替换清单地址。
 */
(function hostdesktopInitialize() {
    "use strict";

    const hostdesktopRequired = Object.freeze(["selBaseRuntime", "selAjax", "selPageBackground", "selPersonalization"]);
    const hostdesktopMissing = hostdesktopRequired.filter((hostdesktopName) => !window[hostdesktopName]);
    if (hostdesktopMissing.length > 0) throw new Error(`工作桌面缺少公共组件：${hostdesktopMissing.join("、")}。`);

    const hostdesktopBase = window.selBaseRuntime;
    const hostdesktopAjax = window.selAjax;
    const hostdesktopRoot = hostdesktopBase.query("[data-hostdesktop-app]");
    const hostdesktopBackgroundHost = hostdesktopBase.query("[data-sel-page-background-host]");
    const hostdesktopPersonalizationHost = hostdesktopBase.query("[data-sel-personalization-host]");
    const hostdesktopAllowedPaths = Object.freeze([
        "/mda/",
        "/reference-data/",
        "/uniauth/",
        // SELPLAT-GENERATED-APPLICATION-PATHS
        "/japanese/"
    ]);

    /** 验证入口仅指向当前 Host 已装配的内部应用，避免配置被改成外部跳转。 */
    function hostdesktopResolveUrl(hostdesktopUrl) {
        const hostdesktopTarget = new URL(String(hostdesktopUrl || ""), window.location.origin);
        const hostdesktopAllowed = hostdesktopTarget.origin === window.location.origin
            && hostdesktopAllowedPaths.some((hostdesktopPath) => hostdesktopTarget.pathname.startsWith(hostdesktopPath));
        return hostdesktopAllowed ? `${hostdesktopTarget.pathname}${hostdesktopTarget.search}${hostdesktopTarget.hash}` : "";
    }

    /** 创建一个真实项目入口；使用链接语义保证鼠标、键盘和新标签页行为一致。 */
    function hostdesktopCreateApplication(hostdesktopApplication) {
        const hostdesktopUrl = hostdesktopResolveUrl(hostdesktopApplication.url);
        const hostdesktopLink = hostdesktopBase.element("a", {
            className: `hostdesktop-application hostdesktop-tone-${hostdesktopApplication.tone || "blue"}`,
            attributes: {
                href: hostdesktopUrl || false,
                target: "_blank",
                rel: "noopener noreferrer",
                "aria-label": `${hostdesktopApplication.name}，在新标签页打开`,
                title: hostdesktopApplication.description,
                "data-hostdesktop-code": hostdesktopApplication.code,
                "aria-disabled": hostdesktopUrl ? false : "true"
            }
        });
        const hostdesktopIcon = hostdesktopBase.element("span", { className: "hostdesktop-application-icon", attributes: { "aria-hidden": "true" } });
        hostdesktopIcon.appendChild(hostdesktopBase.element("i", { className: hostdesktopApplication.icon || "ri-apps-2-line" }));
        const hostdesktopName = hostdesktopBase.element("strong", { className: "hostdesktop-application-name", text: hostdesktopApplication.shortName || hostdesktopApplication.name });
        const hostdesktopDescription = hostdesktopBase.element("span", { className: "hostdesktop-application-description", text: hostdesktopApplication.description });
        hostdesktopLink.append(hostdesktopIcon, hostdesktopName, hostdesktopDescription);
        return hostdesktopLink;
    }

    /** 按静态清单装配桌面；visible/permissionCode 已预留给未来后端权限过滤。 */
    async function hostdesktopMount() {
        const hostdesktopResponse = await hostdesktopAjax.json({ url: "./applications.json?v=20260808-desktop-1" });
        const hostdesktopApplications = (hostdesktopResponse.applications || [])
            .filter((hostdesktopApplication) => hostdesktopApplication.visible !== false && hostdesktopApplication.enabled !== false)
            .sort((hostdesktopLeft, hostdesktopRight) => Number(hostdesktopLeft.sortnum || 0) - Number(hostdesktopRight.sortnum || 0));

        const hostdesktopHeader = hostdesktopBase.element("header", { className: "hostdesktop-menubar" });
        const hostdesktopBrand = hostdesktopBase.element("div", { className: "hostdesktop-brand" });
        hostdesktopBrand.append(
            hostdesktopBase.element("span", { className: "hostdesktop-brand-mark", text: "S" }),
            hostdesktopBase.element("strong", { className: "hostdesktop-brand-name", text: "SELPLAT" }),
            hostdesktopBase.element("span", { className: "hostdesktop-brand-separator", text: "·" }),
            hostdesktopBase.element("span", { className: "hostdesktop-brand-caption", text: "工作桌面" })
        );
        const hostdesktopStatus = hostdesktopBase.element("div", { className: "hostdesktop-status" });
        hostdesktopStatus.append(
            hostdesktopBase.element("span", { className: "hostdesktop-online-dot", attributes: { "aria-hidden": "true" } }),
            hostdesktopBase.element("span", { text: `${hostdesktopApplications.length} 个应用可用` }),
            hostdesktopBase.element("time", { className: "hostdesktop-clock", attributes: { "data-hostdesktop-clock": "", "aria-label": "当前时间" } })
        );
        hostdesktopHeader.append(hostdesktopBrand, hostdesktopStatus);

        const hostdesktopWorkspace = hostdesktopBase.element("section", { className: "hostdesktop-workspace", attributes: { "aria-labelledby": "hostdesktop-heading" } });
        const hostdesktopIntro = hostdesktopBase.element("div", { className: "hostdesktop-intro" });
        const hostdesktopEyebrow = hostdesktopBase.element("span", { className: "hostdesktop-eyebrow", text: "PLATFORM LAUNCHER" });
        const hostdesktopHeading = hostdesktopBase.element("h1", { className: "hostdesktop-heading", text: "选择一个工作空间", attributes: { id: "hostdesktop-heading" } });
        const hostdesktopLead = hostdesktopBase.element("p", { className: "hostdesktop-lead", text: "每个图标对应一个独立工程，点击后在新标签页打开。" });
        hostdesktopIntro.append(hostdesktopEyebrow, hostdesktopHeading, hostdesktopLead);

        const hostdesktopGrid = hostdesktopBase.element("div", { className: "hostdesktop-application-grid", attributes: { role: "list", "aria-label": "项目入口" } });
        hostdesktopApplications.forEach((hostdesktopApplication) => {
            const hostdesktopItem = hostdesktopBase.element("div", { className: "hostdesktop-application-item", attributes: { role: "listitem" } });
            hostdesktopItem.appendChild(hostdesktopCreateApplication(hostdesktopApplication));
            hostdesktopGrid.appendChild(hostdesktopItem);
        });
        hostdesktopWorkspace.append(hostdesktopIntro, hostdesktopGrid);

        const hostdesktopDock = hostdesktopBase.element("footer", { className: "hostdesktop-dock", attributes: { "aria-label": "平台状态" } });
        hostdesktopDock.append(
            hostdesktopBase.element("span", { className: "hostdesktop-dock-icon", attributes: { "aria-hidden": "true" } }),
            hostdesktopBase.element("span", { className: "hostdesktop-dock-copy", text: "统一端口 · 独立工程 · 共用主题" }),
            hostdesktopBase.element("span", { className: "hostdesktop-dock-hint", text: "右上角可切换外观" })
        );

        hostdesktopRoot.append(hostdesktopHeader, hostdesktopWorkspace, hostdesktopDock);
        const hostdesktopClock = hostdesktopBase.query("[data-hostdesktop-clock]", hostdesktopRoot);
        const hostdesktopUpdateClock = () => {
            hostdesktopClock.textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
        };
        hostdesktopUpdateClock();
        window.setInterval(hostdesktopUpdateClock, 30000);
    }

    const hostdesktopBackgroundController = window.selPageBackground.mount(hostdesktopBackgroundHost, {
        defaults: Object.freeze({ theme: "crystal-tech-dark-stellar-blue", overlay: 28, brightness: 92, blur: 0 })
    });
    if (!hostdesktopBackgroundController) throw new Error("工作桌面背景挂载失败。");
    if (!window.selPersonalization.mount(hostdesktopPersonalizationHost, { backgroundController: hostdesktopBackgroundController })) {
        throw new Error("工作桌面个性化设置挂载失败。");
    }
    hostdesktopMount().catch((hostdesktopError) => {
        console.error("工作桌面初始化失败。", hostdesktopError);
        throw hostdesktopError;
    });
}());
