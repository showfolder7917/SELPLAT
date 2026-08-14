/*
 * selLocaleRuntime.js：运行时国际化协调器。
 * 只负责先加载全部语言资源，再通知已登记控制器原位更新；不识别任何项目目录、业务字段或组件内部 DOM。
 */
(function selLocaleRuntimeInitialize(global) {
    "use strict";

    const selFreeze = window.sel.core.freeze;

    /** 创建一个页面级语言会话，所有状态仅存在于当前页面内存。 */
    function selLocaleRuntimeCreate(options = {}) {
        const supportedLocales = new Set(Array.isArray(options.supportedLocales) ? options.supportedLocales.map(String) : []);
        let currentLocale = String(options.initialLocale || "zh-CN");
        let switching = false;
        const participants = new Map();

        function register(definition = {}) {
            const id = String(definition.id || "");
            if (!id || typeof definition.load !== "function") return false;
            const apply = typeof definition.apply === "function"
                ? definition.apply
                : definition.controller?.setLocale?.bind(definition.controller);
            if (typeof apply !== "function") return false;
            participants.set(id, selFreeze({ id, load: definition.load, apply, priority: Number(definition.priority) || 0 }));
            return true;
        }

        async function setLocale(nextLocale) {
            const requestedLocale = String(nextLocale || "");
            if (switching || requestedLocale === currentLocale || !supportedLocales.has(requestedLocale)) return false;
            switching = true;
            try {
                const orderedParticipants = Array.from(participants.values()).sort((left, right) => left.priority - right.priority);
                // 所有公共与项目资源先完整加载；任一失败时保持当前界面和语言不变。
                const prepared = await Promise.all(orderedParticipants.map(async (participant) => ({
                    participant,
                    resource: await participant.load(requestedLocale)
                })));
                // 资源齐备后才原位更新组件，避免网络快慢造成中日英混杂界面。
                for (const item of prepared) {
                    const applied = await item.participant.apply(selFreeze({ locale: requestedLocale, resource: item.resource }));
                    if (applied === false) throw new Error(`语言组件更新失败：${item.participant.id}`);
                }
                currentLocale = requestedLocale;
                global.dispatchEvent(new CustomEvent("selLocale:change", { detail: selFreeze({ locale: currentLocale }) }));
                return true;
            } finally {
                switching = false;
            }
        }

        return {
            register,
            setLocale,
            getLocale: () => currentLocale,
            isSwitching: () => switching,
            list: () => selFreeze(Array.from(participants.keys()))
        };
    }

    window.sel.register("locale.runtime", { create: selLocaleRuntimeCreate });
})(window);
