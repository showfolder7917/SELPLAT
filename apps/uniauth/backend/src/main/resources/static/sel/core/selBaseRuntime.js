/*
 * selBaseRuntime.js：静态网页公共基础运行时。
 * 负责安全文本、DOM 创建、分页数据存储、页面元数据、原生对话框和操作反馈等共享能力。
 * 责任边界：只提供通用函数，不读取任何应用实体、页面模块或业务数据。
 * 模块级 JavaScript 标识统一使用 selBase 前缀，避免与具体业务页面的脚本名称冲突。
 */
(function selBaseCreateRuntime(global) {
    "use strict";

    // 把可空业务值转换成安全文本，避免数据库内容被当作 HTML 插入页面。
    function selBaseText(value, fallback = "—") {
        // null、undefined 与空字符串都使用页面指定的业务占位文案。
        if (value === null || value === undefined || value === "") {
            return fallback;
        }
        // 其他数据统一转成字符串供 textContent 和表单字段使用。
        return String(value);
    }

    // 按选择器取得页面唯一节点，缺失时立即暴露页面结构错误。
    function selBaseQuery(selector, root = document) {
        // 当前选择器只在指定页面根节点内查询，避免组件误取其他弹窗中的同名字段。
        const element = root.querySelector(selector);
        // 必需节点缺失意味着静态页面与脚本契约不一致，停止后续渲染并提供明确错误。
        if (!element) {
            throw new Error(`selBaseRuntime 未找到页面节点: ${selector}`);
        }
        // 返回已经验证存在的节点，调用方无需重复空值判断。
        return element;
    }

    // 根据标签、类名和业务文本创建页面节点，统一组件生成入口。
    function selBaseCreateElement(tagName, options = {}) {
        // 创建真实 DOM 节点，所有动态表格内容都由浏览器原生节点承载。
        const node = document.createElement(tagName);
        // 业务样式类存在时一次写入，保持组件结构与皮肤样式解耦。
        if (options.className) {
            node.className = options.className;
        }
        // 业务文本通过 textContent 写入，阻断接口字段中的 HTML 注入。
        if (options.text !== undefined) {
            node.textContent = selBaseText(options.text, "");
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

    /**
     * 读取当前页面查询参数并提供稳定回退。
     * @param {string} name - 查询参数名称，例如 multi 或 lang。
     * @param {string} fallback - 参数缺失时返回的默认值。
     * @returns {string} 当前 URL 中的参数值或调用方回退值。
     */
    function selBaseGetLocationParam(name, fallback = "") {
        // URLSearchParams 统一处理编码和缺失参数。
        return new URLSearchParams(global.location.search).get(name) || fallback;
    }

    /**
     * 设置页面级语言与标题元数据。
     * @param {{lang?: string, title?: string}} metadata - 应用装配层提供的当前语言和页面标题。
     * @returns {boolean} 元数据应用完成时返回 true。
     */
    function selBaseSetDocumentMetadata(metadata = {}) {
        // 当前语言存在时同步 html lang，辅助技术和格式化逻辑据此工作。
        if (metadata.lang) {
            document.documentElement.lang = String(metadata.lang);
        }
        // 当前标题存在时同步浏览器标签名称。
        if (metadata.title) {
            document.title = String(metadata.title);
        }
        // true 表示基础运行时已处理全部有效字段。
        return true;
    }

    // Store 只管理分页列表的加载状态和最终快照，不复制完整 Ext 数据层。
    class SelBaseStore {
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
    class SelBaseDialog {
        // 绑定一个现有 dialog 节点作为页面弹窗。
        constructor(selector) {
            // 对话框必须来自当前静态页面，避免运行期拼接不可控 HTML。
            this.node = selBaseQuery(selector);
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
    function selBaseShowToast(message, type = "info") {
        // 页面固定 Toast 区域承接所有异步操作结果。
        const region = selBaseQuery("#toast-region");
        // 每条提示使用独立节点，连续操作不会互相覆盖。
        const item = selBaseCreateElement("div", {
            className: `selbase-feedback-toast selbase-feedback-${type}`,
            text: message,
            attributes: { role: type === "error" ? "alert" : "status" }
        });
        // 新提示追加到区域底部，保持操作发生顺序。
        region.appendChild(item);
        // 四秒后移除已读提示，避免页面长期堆积历史消息。
        global.setTimeout(() => item.remove(), 4000);
    }

    // confirm 使用浏览器可靠确认能力承接删除等不可逆业务动作。
    function selBaseConfirmAction(message) {
        // 返回布尔结果给业务动作，用户取消时不会发送写请求。
        return global.confirm(message);
    }

    // formatDateTime 将后台 ISO 时间转换成当前浏览器易读格式。
    function selBaseFormatDateTime(value) {
        // 没有更新时间的旧数据使用稳定占位。
        if (!value) {
            return "—";
        }
        // 创建本地时间对象，让界面遵循用户系统时区。
        const date = new Date(value);
        // 非法日期保持原始值，便于联调时发现后台格式问题。
        if (Number.isNaN(date.getTime())) {
            return selBaseText(value);
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

    // 对外只暴露应用装配层可以复用的精简基础能力集合。
    global.selBaseRuntime = Object.freeze({
        // Dialog 提供统一原生模态框控制能力。
        Dialog: SelBaseDialog,
        // Store 提供分页列表加载状态与数据快照能力。
        Store: SelBaseStore,
        // confirm 为删除等危险操作返回用户确认结果。
        confirm: selBaseConfirmAction,
        // element 负责创建带安全文本和可访问属性的 DOM 节点。
        element: selBaseCreateElement,
        // formatDateTime 负责把接口时间转换为本地展示格式。
        formatDateTime: selBaseFormatDateTime,
        // param 负责读取当前页面查询参数。
        param: selBaseGetLocationParam,
        // query 负责取得页面必需节点并在结构失配时快速报错。
        query: selBaseQuery,
        // text 负责把可空业务值转换为安全展示文本。
        text: selBaseText,
        // setDocument 负责同步页面语言和浏览器标题。
        setDocument: selBaseSetDocumentMetadata,
        // toast 负责向固定反馈区域追加短时操作结果。
        toast: selBaseShowToast
    });
})(window);
