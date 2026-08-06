/*
 * selPersonalizationRegistry.js：个性化设置中心的 JSON 配置注册表。
 * 负责校验后端返回的设置分组、作用域、权限标识和字段描述，并向公共设置面板提供不可变清单。
 * 责任边界：注册表不发起业务请求、不判断真实权限、不保存用户数据；应用装配层负责请求 JSON，后端负责最终授权。
 */
(function selPersonalizationRegistryInitialize() {
    "use strict";

    // 四种作用域区分即时预览、用户偏好、项目页面配置和系统统一配置。
    const selPersonalizationRegistryScopes = Object.freeze(["session", "user", "page", "system"]);
    // 三个一级区域保持长期稳定，新增业务属性只增加模块，不继续扩展顶部选项卡。
    const selPersonalizationRegistryAreas = Object.freeze(["appearance", "user", "page"]);
    // 模块按稳定 ID 覆盖更新，便于语言或项目切换后用新 JSON 原位替换配置。
    const selPersonalizationRegistryModules = new Map();

    /**
     * 把后端 JSON 中的单个设置模块校验并冻结为公共描述。
     * @param {object} selPersonalizationRegistryDefinition - 后端或应用传入的模块定义。
     * @returns {object|null} 合法时返回不可变模块，非法输入不进入设置中心。
     */
    function selPersonalizationRegistryNormalize(selPersonalizationRegistryDefinition) {
        if (!selPersonalizationRegistryDefinition || typeof selPersonalizationRegistryDefinition !== "object") return null;
        const selPersonalizationRegistryId = String(selPersonalizationRegistryDefinition.id || "").trim();
        const selPersonalizationRegistryArea = String(selPersonalizationRegistryDefinition.area || "").trim();
        const selPersonalizationRegistryScope = String(selPersonalizationRegistryDefinition.scope || "session").trim();
        if (!/^[a-z][a-z0-9.-]*$/i.test(selPersonalizationRegistryId)
            || !selPersonalizationRegistryAreas.includes(selPersonalizationRegistryArea)
            || !selPersonalizationRegistryScopes.includes(selPersonalizationRegistryScope)) {
            return null;
        }
        // 字段只保留公开描述；实际值仍需由后端按作用域与权限校验。
        const selPersonalizationRegistryFields = Array.isArray(selPersonalizationRegistryDefinition.fields)
            ? selPersonalizationRegistryDefinition.fields.filter((selPersonalizationRegistryField) => selPersonalizationRegistryField && typeof selPersonalizationRegistryField === "object").map((selPersonalizationRegistryField) => Object.freeze({ ...selPersonalizationRegistryField }))
            : [];
        return Object.freeze({
            id: selPersonalizationRegistryId,
            area: selPersonalizationRegistryArea,
            scope: selPersonalizationRegistryScope,
            titleKey: String(selPersonalizationRegistryDefinition.titleKey || selPersonalizationRegistryId),
            descriptionKey: String(selPersonalizationRegistryDefinition.descriptionKey || ""),
            icon: String(selPersonalizationRegistryDefinition.icon || "ri-settings-3-line"),
            order: Number.isFinite(Number(selPersonalizationRegistryDefinition.order)) ? Number(selPersonalizationRegistryDefinition.order) : 100,
            permission: String(selPersonalizationRegistryDefinition.permission || ""),
            editable: selPersonalizationRegistryDefinition.editable !== false,
            fields: Object.freeze(selPersonalizationRegistryFields)
        });
    }

    /** 注册一个模块；同 ID 的新项目配置替换旧描述。 */
    function selPersonalizationRegistryRegister(selPersonalizationRegistryDefinition) {
        const selPersonalizationRegistryModule = selPersonalizationRegistryNormalize(selPersonalizationRegistryDefinition);
        if (!selPersonalizationRegistryModule) return false;
        selPersonalizationRegistryModules.set(selPersonalizationRegistryModule.id, selPersonalizationRegistryModule);
        return true;
    }

    /**
     * 原子装载一次后端 JSON；校验失败时保留原配置，避免设置页进入半更新状态。
     * @param {{modules:Array<object>}} selPersonalizationRegistryPayload - 项目设置接口返回体。
     * @returns {boolean} 全部模块合法并完成替换时返回 true。
     */
    function selPersonalizationRegistryReplaceFromJson(selPersonalizationRegistryPayload) {
        if (!selPersonalizationRegistryPayload || !Array.isArray(selPersonalizationRegistryPayload.modules)) return false;
        const selPersonalizationRegistryNextModules = selPersonalizationRegistryPayload.modules.map(selPersonalizationRegistryNormalize);
        if (selPersonalizationRegistryNextModules.some((selPersonalizationRegistryModule) => !selPersonalizationRegistryModule)) return false;
        selPersonalizationRegistryModules.clear();
        selPersonalizationRegistryNextModules.forEach((selPersonalizationRegistryModule) => {
            selPersonalizationRegistryModules.set(selPersonalizationRegistryModule.id, selPersonalizationRegistryModule);
        });
        return true;
    }

    /** 按区域和顺序返回不可变模块清单，权限过滤由已获授权的应用回调完成。 */
    function selPersonalizationRegistryList(selPersonalizationRegistryOptions = {}) {
        const selPersonalizationRegistryArea = String(selPersonalizationRegistryOptions.area || "");
        const selPersonalizationRegistryCanAccess = typeof selPersonalizationRegistryOptions.canAccess === "function"
            ? selPersonalizationRegistryOptions.canAccess
            : () => true;
        return Object.freeze(Array.from(selPersonalizationRegistryModules.values())
            .filter((selPersonalizationRegistryModule) => (!selPersonalizationRegistryArea || selPersonalizationRegistryModule.area === selPersonalizationRegistryArea)
                && selPersonalizationRegistryCanAccess(selPersonalizationRegistryModule.permission, selPersonalizationRegistryModule))
            .sort((selPersonalizationRegistryLeft, selPersonalizationRegistryRight) => selPersonalizationRegistryLeft.order - selPersonalizationRegistryRight.order));
    }

    // 公开 API 只管理描述元数据；真实取值、保存和权限判断继续由项目与后端拥有。
    window.selPersonalizationRegistry = Object.freeze({
        scopes: selPersonalizationRegistryScopes,
        areas: selPersonalizationRegistryAreas,
        register: selPersonalizationRegistryRegister,
        replaceFromJson: selPersonalizationRegistryReplaceFromJson,
        list: selPersonalizationRegistryList
    });
})();
