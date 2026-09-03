/*
 * selKernel.js：SEL UI 唯一公共命名空间和注册内核。
 *
 * 页面必须最先加载本文件。shared 中的能力通过 register() 注册到 window.sel，
 * 应用只消费已经登记的 API，禁止再发布 window.sel.components.grid 一类平铺全局变量。
 */
(function selKernelInitialize(global) {
    "use strict";

    if (global.sel) {
        throw new Error("SEL UI 内核被重复加载。");
    }

    const selPlainObjectPrototype = Object.prototype;
    const selNamespaces = {
        core: {},
        net: {},
        locale: {},
        theme: {},
        components: {}
    };

    /**
     * 深度冻结只读配置快照。
     *
     * 只递归普通对象和数组；DOM、Map、Set、Date、类实例和控制器对象不会被误改内部生命周期。
     * 循环引用由 WeakSet 截断。示例：freeze({ grid: { pageSize: 20 } })。
     *
     * @param {*} value - 需要变成只读快照的值。
     * @returns {*} 原值；普通对象和数组已递归冻结，其他类型保持原样。
     */
    function selFreeze(value, visited = new WeakSet()) {
        if (value === null || (typeof value !== "object" && typeof value !== "function")) {
            return value;
        }
        if (typeof value === "function") {
            return value;
        }
        const prototype = Object.getPrototypeOf(value);
        if (!Array.isArray(value) && prototype !== selPlainObjectPrototype && prototype !== null) {
            return value;
        }
        if (visited.has(value)) {
            return value;
        }
        visited.add(value);
        Reflect.ownKeys(value).forEach((key) => selFreeze(value[key], visited));
        return Object.freeze(value);
    }

    /** 按点分路径读取已注册能力；不存在时返回 undefined。 */
    function selResolve(path) {
        return String(path || "").split(".").filter(Boolean).reduce(
            (current, segment) => current?.[segment],
            selRoot
        );
    }

    /**
     * 注册一个公共 API。
     *
     * 示例：register("components.grid", { mount }) 后由 window.sel.components.grid.mount() 调用。
     * 同一路径只能登记一次，避免加载顺序错误被静默覆盖。
     */
    function selRegister(path, api) {
        const segments = String(path || "").split(".").filter(Boolean);
        if (segments.length === 0) {
            throw new Error("SEL UI 公共 API 缺少注册路径。");
        }
        const propertyName = segments.pop();
        let owner = selRoot;
        segments.forEach((segment) => {
            if (!Object.prototype.hasOwnProperty.call(owner, segment)) {
                Object.defineProperty(owner, segment, {
                    value: {}, enumerable: true, configurable: false, writable: false
                });
            }
            owner = owner[segment];
        });
        if (Object.prototype.hasOwnProperty.call(owner, propertyName)) {
            throw new Error(`SEL UI 公共 API 已注册：${path}`);
        }
        const registeredApi = selFreeze(api);
        Object.defineProperty(owner, propertyName, {
            value: registeredApi, enumerable: true, configurable: false, writable: false
        });
        return registeredApi;
    }

    /**
     * 向既有命名空间一次登记多个不重复成员。
     * 基础运行时使用 registerAll("core", { text, query })，应用不应调用此方法。
     */
    function selRegisterAll(namespacePath, apiMembers) {
        if (!apiMembers || Object.getPrototypeOf(apiMembers) !== selPlainObjectPrototype) {
            throw new Error(`SEL UI 命名空间注册内容无效：${namespacePath}`);
        }
        Object.entries(apiMembers).forEach(([name, api]) => selRegister(`${namespacePath}.${name}`, api));
        return selResolve(namespacePath);
    }

    /**
     * 校验页面所需能力并返回路径到 API 的只读映射。
     * 示例：require(["components.grid", "components.tree"])。
     */
    function selRequire(paths) {
        const requiredPaths = Array.isArray(paths) ? paths : [paths];
        const resolved = {};
        const missing = [];
        requiredPaths.forEach((path) => {
            const value = selResolve(path);
            if (value === undefined) {
                missing.push(path);
            } else {
                resolved[path] = value;
            }
        });
        if (missing.length > 0) {
            throw new Error(`页面缺少 SEL UI 能力：${missing.join("、")}。`);
        }
        return selFreeze(resolved);
    }

    const selRoot = {};
    Object.entries(selNamespaces).forEach(([name, namespace]) => {
        Object.defineProperty(selRoot, name, {
            value: namespace, enumerable: true, configurable: false, writable: false
        });
    });
    Object.defineProperties(selRoot, {
        register: { value: selRegister, enumerable: true },
        registerAll: { value: selRegisterAll, enumerable: true },
        resolve: { value: selResolve, enumerable: true },
        require: { value: selRequire, enumerable: true }
    });
    selRegister("core.freeze", selFreeze);

    Object.defineProperty(global, "sel", {
        value: selRoot, enumerable: true, configurable: false, writable: false
    });
}(window));
