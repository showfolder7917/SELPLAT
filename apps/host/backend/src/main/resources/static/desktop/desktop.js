/*
 * desktop.js：SELPLAT 统一工作桌面装配层。
 * 应用入口来自静态 JSON；未来后端返回同一结构时只需替换清单地址。
 *
 * SEL UI 依赖：core 负责 DOM 与安全文本，ajax 负责同源请求，pageBackground 和
 * personalization 分别负责页面背景与个性化入口。公共组件只在文件顶部解构一次。
 *
 * 阅读顺序：desktopAllowedPaths 定义安全边界，desktopCreateApplication() 创建单个入口，
 * mountApp() 读取清单并组装桌面。关键语句组使用中文解释，函数内变量保持简洁。
 */
(function app() {
    "use strict";

    window.sel.require(["core.element", "core.query", "net.ajax", "components.pageBackground", "components.personalization"]);
    const selBase = window.sel.core;
    // element 统一创建安全节点；selFreeze 只保护完整路径白名单。
    const { element, freeze: selFreeze } = selBase;
    const { ajax: selAjax } = window.sel.net;
    const { pageBackground, personalization } = window.sel.components;
    // 三个宿主分别承载桌面内容、背景和个性化入口。
    const desktopRoot = selBase.query("[data-hostdesktop-app]");
    const desktopBackgroundHost = selBase.query("[data-sel-page-background-host]");
    const desktopPersonalizationHost = selBase.query("[data-sel-personalization-host]");
    // 只允许跳转到 Host 已装配的同源应用路径。
    const desktopAllowedPaths = selFreeze([
        "/mda/",
        "/reference-data/",
        "/uniauth/",
        // SELPLAT-GENERATED-APPLICATION-PATHS
        "/japanese/"
    ]);

    /** 验证入口仅指向当前 Host 已装配的内部应用，避免配置被改成外部跳转。 */
    function desktopResolveUrl(url) {
        // URL 统一按当前站点解析，相对路径和绝对同源路径使用同一校验。
        const target = new URL(String(url || ""), window.location.origin);
        // 必须同源且命中应用白名单，外部地址和未装配路径都被拒绝。
        const allowed = target.origin === window.location.origin
            && desktopAllowedPaths.some((path) => target.pathname.startsWith(path));
        return allowed ? `${target.pathname}${target.search}${target.hash}` : "";
    }

    /** 创建一个真实项目入口；使用链接语义保证鼠标、键盘和新标签页行为一致。 */
    function desktopCreateApplication(application) {
        // 先解析安全地址；空地址会生成不可用但仍可读的入口卡片。
        const url = desktopResolveUrl(application.url);
        // 链接语义天然支持键盘和新标签页，属性由 element 安全写入。
        const link = element("a", {
            className: `hostdesktop-application hostdesktop-tone-${application.tone || "blue"}`,
            attributes: {
                href: url || false,
                target: "_blank",
                rel: "noopener noreferrer",
                "aria-label": `${application.name}，在新标签页打开`,
                title: application.description,
                "data-hostdesktop-code": application.code,
                "aria-disabled": url ? false : "true"
            }
        });
        // 图标、名称和说明分别创建，避免把清单文字拼接为 innerHTML。
        const icon = element("span", { className: "hostdesktop-application-icon", attributes: { "aria-hidden": "true" } });
        icon.appendChild(element("i", { className: application.icon || "ri-apps-2-line" }));
        const name = element("strong", { className: "hostdesktop-application-name", text: application.shortName || application.name });
        const description = element("span", { className: "hostdesktop-application-description", text: application.description });
        link.append(icon, name, description);
        return link;
    }

    /** 按静态清单装配桌面；visible/permissionCode 已预留给未来后端权限过滤。 */
    async function mountApp() {
        // applications.json 是当前桌面唯一入口清单，将来可替换为同结构后台响应。
        const response = await selAjax.json({ url: "./applications.json?v=20260808-desktop-1" });
        // 先过滤隐藏/停用应用，再按业务 sortnum 稳定排序。
        const applications = (response.applications || [])
            .filter((application) => application.visible !== false && application.enabled !== false)
            .sort((left, right) => Number(left.sortnum || 0) - Number(right.sortnum || 0));

        // 顶部菜单栏由品牌和当前可用应用数量组成。
        const header = element("header", { className: "hostdesktop-menubar" });
        const brand = element("div", { className: "hostdesktop-brand" });
        brand.append(
            element("span", { className: "hostdesktop-brand-mark", text: "S" }),
            element("strong", { className: "hostdesktop-brand-name", text: "SELPLAT" }),
            element("span", { className: "hostdesktop-brand-separator", text: "·" }),
            element("span", { className: "hostdesktop-brand-caption", text: "工作桌面" })
        );
        const status = element("div", { className: "hostdesktop-status" });
        status.append(
            element("span", { className: "hostdesktop-online-dot", attributes: { "aria-hidden": "true" } }),
            element("span", { text: `${applications.length} 个应用可用` }),
            element("time", { className: "hostdesktop-clock", attributes: { "data-hostdesktop-clock": "", "aria-label": "当前时间" } })
        );
        header.append(brand, status);

        // 主工作区包含说明文字和应用入口网格。
        const workspace = element("section", { className: "hostdesktop-workspace", attributes: { "aria-labelledby": "hostdesktop-heading" } });
        const intro = element("div", { className: "hostdesktop-intro" });
        const eyebrow = element("span", { className: "hostdesktop-eyebrow", text: "PLATFORM LAUNCHER" });
        const heading = element("h1", { className: "hostdesktop-heading", text: "选择一个工作空间", attributes: { id: "hostdesktop-heading" } });
        const lead = element("p", { className: "hostdesktop-lead", text: "每个图标对应一个独立工程，点击后在新标签页打开。" });
        intro.append(eyebrow, heading, lead);

        // role=list/listitem 为入口集合提供明确可访问结构。
        const applicationGrid = element("div", { className: "hostdesktop-application-grid", attributes: { role: "list", "aria-label": "项目入口" } });
        applications.forEach((application) => {
            const item = element("div", { className: "hostdesktop-application-item", attributes: { role: "listitem" } });
            item.appendChild(desktopCreateApplication(application));
            applicationGrid.appendChild(item);
        });
        workspace.append(intro, applicationGrid);

        // 底部 Dock 只展示平台状态，不承担业务导航。
        const dock = element("footer", { className: "hostdesktop-dock", attributes: { "aria-label": "平台状态" } });
        dock.append(
            element("span", { className: "hostdesktop-dock-icon", attributes: { "aria-hidden": "true" } }),
            element("span", { className: "hostdesktop-dock-copy", text: "统一端口 · 独立工程 · 共用主题" }),
            element("span", { className: "hostdesktop-dock-hint", text: "右上角可切换外观" })
        );

        // 页面结构完整后一次性写入根宿主，再启动时钟。
        desktopRoot.append(header, workspace, dock);
        const clock = selBase.query("[data-hostdesktop-clock]", desktopRoot);
        // 时钟函数只更新时间文字，30 秒刷新足以覆盖分钟变化。
        const updateClock = () => {
            clock.textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
        };
        updateClock();
        window.setInterval(updateClock, 30000);
    }

    // 背景先挂载，personalization 才能取得实时预览控制器。
    const desktopBackgroundController = pageBackground.mount(desktopBackgroundHost, {
        defaults: { theme: "crystal-tech-dark-stellar-blue", overlay: 28, brightness: 92, blur: 0 }
    });
    if (!desktopBackgroundController) throw new Error("工作桌面背景挂载失败。");
    if (!personalization.mount(desktopPersonalizationHost, { backgroundController: desktopBackgroundController })) {
        throw new Error("工作桌面个性化设置挂载失败。");
    }
    mountApp().catch((error) => {
        console.error("工作桌面初始化失败。", error);
        throw error;
    });
}());
