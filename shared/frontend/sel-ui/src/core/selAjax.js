/*
 * selAjax.js：SEL 网页通用异步请求基础能力。
 * 负责接收调用方显式传入的请求地址、发送同源请求、解析 JSON，并统一报告 HTTP、解析和业务响应错误。
 * 责任边界：本文件不知道 具体应用、业务实体、接口路由或模拟数据目录；所有实际地址必须由应用装配层传入。
 * 模块级 JavaScript 标识统一使用 selAjax 前缀，公开只读接口为 window.sel.net.ajax。
 */
(function selAjaxCreateClient(global) {
    "use strict";

    const selFreeze = window.sel.core.freeze;

    // 默认请求头只表达通用异步请求特征，不携带任何应用或实体信息。
    const selAjaxDefaultHeaders = selFreeze({
        "X-Requested-With": "XMLHttpRequest"
    });

    /**
     * 校验调用方提供的请求地址。
     * @param {unknown} selAjaxUrl - 应用装配层或业务服务显式传入的同源地址。
     * @returns {string} 去除首尾空白后可交给 fetch 的真实地址。
     */
    function selAjaxRequireUrl(selAjaxUrl) {
        // 地址必须是非空字符串，禁止基础请求层猜测默认业务接口。
        if (typeof selAjaxUrl !== "string" || !selAjaxUrl.trim()) {
            throw new TypeError("selAjax：请求配置缺少有效 url。");
        }
        // 返回规范化地址，但不改变调用方声明的相对路径、查询参数或接口路由。
        return selAjaxUrl.trim();
    }

    /**
     * 把普通数据对象转换为后端可读取的表单请求体。
     * @param {Record<string, unknown>} selAjaxData - 调用方显式传入的写操作字段。
     * @returns {URLSearchParams} UTF-8 application/x-www-form-urlencoded 请求体。
     */
    function selAjaxToFormBody(selAjaxData) {
        // URLSearchParams 负责通用字段编码，不解释字段业务含义。
        const selAjaxBody = new URLSearchParams();
        // 每个有效字段按调用方名称原样加入请求体。
        Object.entries(selAjaxData || {}).forEach(([selAjaxName, selAjaxValue]) => {
            // 空值不进入写请求，避免把未提供字段误当作清空指令。
            if (selAjaxValue !== undefined && selAjaxValue !== null && selAjaxValue !== "") {
                selAjaxBody.append(selAjaxName, String(selAjaxValue));
            }
        });
        // 返回浏览器 fetch 可以直接发送的标准表单对象。
        return selAjaxBody;
    }

    /**
     * 发送请求并返回响应文本及状态元数据。
     * @param {{url: string, method?: string, headers?: Record<string, string>, data?: Record<string, unknown>, signal?: AbortSignal}} selAjaxConfig - 通用请求配置。
     * @returns {Promise<{url: string, response: Response, text: string}>} 返回真实地址、浏览器响应和 UTF-8 正文。
     */
    async function selAjaxSend(selAjaxConfig = {}) {
        // 请求地址必须由调用方显式声明。
        const selAjaxUrl = selAjaxRequireUrl(selAjaxConfig.url);
        // 未声明方法时采用只读 GET。
        const selAjaxMethod = String(selAjaxConfig.method || "GET").toUpperCase();
        // 默认请求头与当前调用补充头合并，调用方值拥有最终优先级。
        const selAjaxHeaders = Object.assign({}, selAjaxDefaultHeaders, selAjaxConfig.headers || {});
        // fetch 配置只包含通用网络参数，不携带应用级默认值。
        const selAjaxFetchOptions = {
            method: selAjaxMethod,
            headers: selAjaxHeaders,
            credentials: "same-origin"
        };
        // 调用方传入取消信号时原样交给浏览器，支持超时或页面卸载中止。
        if (selAjaxConfig.signal) {
            selAjaxFetchOptions.signal = selAjaxConfig.signal;
        }
        // 非 GET 写操作存在数据时统一转换为表单正文。
        if (selAjaxConfig.data && selAjaxMethod !== "GET") {
            selAjaxFetchOptions.body = selAjaxToFormBody(selAjaxConfig.data);
        }
        // 浏览器负责执行调用方声明的请求地址。
        const selAjaxResponse = await fetch(selAjaxUrl, selAjaxFetchOptions);
        // 先读取文本，确保错误响应中的说明和 requestId 不会丢失。
        const selAjaxText = await selAjaxResponse.text();
        // 返回稳定的通用响应上下文供不同解析入口复用。
        return {
            url: selAjaxUrl,
            response: selAjaxResponse,
            text: selAjaxText
        };
    }

    /**
     * 把响应文本解析成 JSON。
     * @param {{url: string, response: Response, text: string}} selAjaxResult - selAjaxSend 返回的响应上下文。
     * @returns {object} 空正文返回空对象，非空正文返回解析后的 JSON。
     */
    function selAjaxParseJson(selAjaxResult) {
        // 空响应统一表示为空对象，避免成功无正文时出现无关解析错误。
        if (!selAjaxResult.text) {
            return {};
        }
        try {
            // JSON.parse 保留后端或静态文件返回的真实对象层级。
            return JSON.parse(selAjaxResult.text);
        } catch (selAjaxError) {
            // 解析异常包含状态和地址，便于定位返回 HTML 或损坏 JSON 的接口。
            throw new Error(`selAjax：JSON 解析失败（HTTP ${selAjaxResult.response.status}）${selAjaxResult.url}`);
        }
    }

    /**
     * 加载不带业务结果包装的 JSON。
     * @param {{url: string, headers?: Record<string, string>, signal?: AbortSignal}} selAjaxConfig - 必须包含实际 JSON 地址的配置。
     * @returns {Promise<object>} HTTP 成功时返回原始 JSON 对象。
     */
    async function selAjaxJson(selAjaxConfig = {}) {
        // JSON 接受类型与调用方请求头合并。
        const selAjaxResult = await selAjaxSend({
            ...selAjaxConfig,
            method: "GET",
            headers: Object.assign({ Accept: "application/json" }, selAjaxConfig.headers || {})
        });
        // HTTP 失败时禁止应用继续使用不完整数据。
        if (!selAjaxResult.response.ok) {
            throw new Error(`selAjax：JSON 加载失败 ${selAjaxResult.response.status} ${selAjaxResult.url}`);
        }
        // 成功响应解析后直接交还调用方，基础层不解释字段业务含义。
        return selAjaxParseJson(selAjaxResult);
    }

    /**
     * 调用带 success、msg、requestId 等业务包装的 JSON 接口。
     * @param {{url: string, method?: string, headers?: Record<string, string>, data?: Record<string, unknown>, signal?: AbortSignal}} selAjaxConfig - 必须包含实际接口地址的配置。
     * @returns {Promise<object>} 成功时返回后端完整响应对象。
     */
    async function selAjaxRequest(selAjaxConfig = {}) {
        // 请求发送与正文读取统一复用底层入口。
        const selAjaxResult = await selAjaxSend(selAjaxConfig);
        // 响应正文转换成通用 JSON 对象。
        const selAjaxPayload = selAjaxParseJson(selAjaxResult);
        // HTTP 失败或业务明确返回 success=false 时进入同一异常出口。
        if (!selAjaxResult.response.ok || selAjaxPayload.success === false) {
            // requestId 存在时附加到错误，方便服务端日志联调。
            const selAjaxRequestSuffix = selAjaxPayload.requestId ? ` · ${selAjaxPayload.requestId}` : "";
            // 优先返回后端业务说明，否则使用 HTTP 状态生成通用错误。
            throw new Error(`${selAjaxPayload.msg || `请求失败（HTTP ${selAjaxResult.response.status}）`}${selAjaxRequestSuffix}`);
        }
        // 返回完整响应，是否读取 data、records 等字段由应用装配层决定。
        return selAjaxPayload;
    }

    // 公开接口只包含稳定请求能力，应用路径和业务响应映射不得进入本对象。
    window.sel.register("net.ajax", {
        // json 负责加载调用方明确指定的原始 JSON 地址。
        json: selAjaxJson,
        // request 负责调用带通用业务结果包装的接口。
        request: selAjaxRequest
    });
})(window);
