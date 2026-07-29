(function createSelRuntime(global) {
    "use strict";

    // Sel 的默认请求头统一声明同源异步调用，便于后台区分浏览器页面请求。
    const DEFAULT_HEADERS = Object.freeze({
        "X-Requested-With": "XMLHttpRequest"
    });

    // 把可空业务值转换成安全文本，避免数据库内容被当作 HTML 插入页面。
    function text(value, fallback = "—") {
        // null、undefined 与空字符串都使用页面指定的业务占位文案。
        if (value === null || value === undefined || value === "") {
            return fallback;
        }
        // 其他数据统一转成字符串供 textContent 和表单字段使用。
        return String(value);
    }

    // 按选择器取得页面唯一节点，缺失时立即暴露页面结构错误。
    function query(selector, root = document) {
        // 当前选择器只在指定页面根节点内查询，避免组件误取其他弹窗中的同名字段。
        const element = root.querySelector(selector);
        // 必需节点缺失意味着静态页面与脚本契约不一致，停止后续渲染并提供明确错误。
        if (!element) {
            throw new Error(`Sel 未找到页面节点: ${selector}`);
        }
        // 返回已经验证存在的节点，调用方无需重复空值判断。
        return element;
    }

    // 根据标签、类名和业务文本创建页面节点，统一组件生成入口。
    function element(tagName, options = {}) {
        // 创建真实 DOM 节点，所有动态表格内容都由浏览器原生节点承载。
        const node = document.createElement(tagName);
        // 业务样式类存在时一次写入，保持组件结构与皮肤样式解耦。
        if (options.className) {
            node.className = options.className;
        }
        // 业务文本通过 textContent 写入，阻断接口字段中的 HTML 注入。
        if (options.text !== undefined) {
            node.textContent = text(options.text, "");
        }
        // 页面需要可访问属性时逐项写入，例如按钮动作和状态标签。
        if (options.attributes) {
            // 每个属性来自组件静态定义，不拼接用户可执行代码。
            Object.entries(options.attributes).forEach(([name, value]) => {
                // 布尔 false 表示当前属性不应出现在最终节点上。
                if (value !== false && value !== null && value !== undefined) {
                    node.setAttribute(name, String(value));
                }
            });
        }
        // 返回可继续追加子节点的组件根节点。
        return node;
    }

    // 把普通业务对象转换为 Spring MVC 可解析的表单请求体。
    function toFormBody(data) {
        // URLSearchParams 生成 UTF-8 application/x-www-form-urlencoded 内容。
        const body = new URLSearchParams();
        // 只提交有意义的字段，避免空密码覆盖数据库已有摘要。
        Object.entries(data || {}).forEach(([name, value]) => {
            // undefined、null 与空字符串不进入后台动态字段映射。
            if (value !== undefined && value !== null && value !== "") {
                body.append(name, String(value));
            }
        });
        // 返回浏览器 fetch 可直接发送的表单请求体。
        return body;
    }

    // 统一完成 JSON 接口调用、错误结构识别和不可解析响应提示。
    async function request(url, options = {}) {
        // 当前页面默认使用 GET；写操作由调用方显式传入 POST。
        const method = String(options.method || "GET").toUpperCase();
        // 合并 Sel 固定请求头与当前接口的补充请求头。
        const headers = Object.assign({}, DEFAULT_HEADERS, options.headers || {});
        // 请求配置只保留浏览器 fetch 支持的字段。
        const fetchOptions = {
            method,
            headers,
            credentials: "same-origin"
        };
        // 写操作的数据对象统一转成 Spring 公共参数解析器支持的表单内容。
        if (options.data && method !== "GET") {
            fetchOptions.body = toFormBody(options.data);
        }
        // 发送同源请求，让 uniauth 静态页面直接调用同一服务的 API。
        const response = await fetch(url, fetchOptions);
        // 无论 HTTP 状态如何都先读取文本，保留后台异常响应中的 requestId 与说明。
        const responseText = await response.text();
        // 空响应使用空对象，避免成功但无正文时 JSON.parse 产生无关错误。
        let payload = {};
        // 非空响应必须是 JSON；解析失败时转换成统一联调错误。
        if (responseText) {
            try {
                // 后台所有用户接口都声明 application/json，这里恢复真实业务结构。
                payload = JSON.parse(responseText);
            } catch (error) {
                // 把不可解析正文包装成可显示的异常，避免页面静默停在加载态。
                throw new Error(`接口返回了无法识别的数据（HTTP ${response.status}）`);
            }
        }
        // HTTP 非成功或业务 success=false 都进入同一错误出口。
        if (!response.ok || payload.success === false) {
            // 优先展示后台业务说明，并把 requestId 留给联调定位。
            const requestSuffix = payload.requestId ? ` · ${payload.requestId}` : "";
            // 抛出用户可理解的错误文本，页面层负责用 Toast 展示。
            throw new Error(`${payload.msg || `请求失败（HTTP ${response.status}）`}${requestSuffix}`);
        }
        // 返回已经验证的业务数据，调用方继续处理分页或 CommonResult。
        return payload;
    }

    // Store 只管理分页列表的加载状态和最终快照，不复制完整 Ext 数据层。
    class Store {
        // 初始化列表加载器与空数据状态。
        constructor(loader) {
            // loader 由业务页面提供，用于把当前筛选状态转换成真实接口请求。
            this.loader = loader;
            // records 保存最近一次成功加载的当前页用户。
            this.records = [];
            // totalCount 保存当前筛选条件下的数据库总数。
            this.totalCount = 0;
            // loading 防止用户连续点击时并发刷新覆盖较新的页面状态。
            this.loading = false;
        }

        // 按业务页面当前状态重新加载数据并保存稳定快照。
        async load(state) {
            // 标记当前加载已开始，页面可以据此禁用重复动作。
            this.loading = true;
            try {
                // 调用业务加载器取得 CommonPageResult 结构。
                const result = await this.loader(state);
                // records 缺失时回落空列表，空页仍能正常渲染。
                this.records = Array.isArray(result.records) ? result.records : [];
                // totalCount 转成数字，保证分页计算不会拼接字符串。
                this.totalCount = Number(result.totalCount || 0);
                // 返回 Store 自身，业务层可在一个表达式中读取快照。
                return this;
            } finally {
                // 无论成功或失败都结束加载态，允许用户重试。
                this.loading = false;
            }
        }
    }

    // Dialog 包装原生 dialog，提供统一打开、关闭和业务数据填充时机。
    class Dialog {
        // 绑定一个现有 dialog 节点作为页面弹窗。
        constructor(selector) {
            // 对话框必须来自当前静态页面，避免运行期拼接不可控 HTML。
            this.node = query(selector);
        }

        // 打开模态对话框并把键盘焦点约束在业务表单内。
        open() {
            // 已打开时不重复调用 showModal，避免浏览器抛出 InvalidStateError。
            if (!this.node.open) {
                this.node.showModal();
            }
        }

        // 关闭当前对话框并回到触发动作所在页面。
        close() {
            // 只在实际打开时调用 close，允许取消按钮被重复触发。
            if (this.node.open) {
                this.node.close();
            }
        }
    }

    // Toast 向固定可访问区域追加短时业务反馈。
    function toast(message, type = "info") {
        // 页面固定 Toast 区域承接所有异步操作结果。
        const region = query("#toast-region");
        // 每条提示使用独立节点，连续操作不会互相覆盖。
        const item = element("div", {
            className: `sel-toast is-${type}`,
            text: message,
            attributes: { role: type === "error" ? "alert" : "status" }
        });
        // 新提示追加到区域底部，保持操作发生顺序。
        region.appendChild(item);
        // 四秒后移除已读提示，避免页面长期堆积历史消息。
        global.setTimeout(() => item.remove(), 4000);
    }

    // confirm 使用浏览器可靠确认能力承接删除等不可逆业务动作。
    function confirmAction(message) {
        // 返回布尔结果给业务动作，用户取消时不会发送写请求。
        return global.confirm(message);
    }

    // formatDateTime 将后台 ISO 时间转换成当前浏览器易读格式。
    function formatDateTime(value) {
        // 没有更新时间的旧数据使用稳定占位。
        if (!value) {
            return "—";
        }
        // 创建本地时间对象，让界面遵循用户系统时区。
        const date = new Date(value);
        // 非法日期保持原始值，便于联调时发现后台格式问题。
        if (Number.isNaN(date.getTime())) {
            return text(value);
        }
        // 使用紧凑的本地日期时间，适合表格单元格展示。
        return new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(date);
    }

    // 对外只暴露当前 uniauth 页面实际需要的精简能力集合。
    global.Sel = Object.freeze({
        Dialog,
        Store,
        confirm: confirmAction,
        element,
        formatDateTime,
        query,
        request,
        text,
        toast
    });
})(window);
