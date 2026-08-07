/*
 * reference-data.js：引用数据类型管理应用装配层。
 * 只声明真实业务接口、页面状态和 DOM 绑定；请求、主题和下拉交互复用 SEL 公共能力。
 */
(function referenceDataInitializeAdmin() {
    "use strict";

    // 公共异步请求和主题能力必须先加载，应用不建立第二套 fetch 或主题状态机。
    const referenceDataAjax = window.selAjax;
    const referenceDataTheme = window.selThemeManager;
    const referenceDataDropdown = window.selDropdownMenu;
    const referenceDataPageBackground = window.selPageBackground;
    const referenceDataPersonalization = window.selPersonalization;
    if (!referenceDataAjax || !referenceDataTheme || !referenceDataDropdown || !referenceDataPageBackground || !referenceDataPersonalization) {
        throw new Error("引用数据管理后台缺少 SEL 公共运行时。");
    }

    // HTML 静态结构是应用唯一挂载范围，业务脚本不扫描其他模块页面。
    const referenceDataHost = document.querySelector("[data-reference-data-app]");
    const referenceDataRows = document.querySelector("[data-reference-data-role='rows']");
    const referenceDataLoading = document.querySelector("[data-reference-data-role='loading']");
    const referenceDataEmpty = document.querySelector("[data-reference-data-role='empty']");
    const referenceDataDialog = document.querySelector("[data-reference-data-role='dialog']");
    const referenceDataForm = document.querySelector("[data-reference-data-role='form']");
    const referenceDataToast = document.querySelector("[data-reference-data-role='toast']");
    const referenceDataKeyword = document.querySelector("[data-reference-data-role='keyword']");
    const referenceDataStatus = document.querySelector("[data-reference-data-role='status']");
    const referenceDataBackgroundHost = document.querySelector("[data-sel-page-background-host]");
    const referenceDataPersonalizationHost = document.querySelector("[data-sel-personalization-host]");
    // 管理 API 根路径由应用显式登记，公共 selAjax 不推测项目或实体地址。
    const referenceDataTypeApi = "/api/reference-data/admin/types";
    // 当前页状态只驻留内存，刷新时重新读取永久数据库事实。
    const referenceDataState = {
        pageNo: 1,
        pageSize: 20,
        totalCount: 0,
        editingId: null,
        loading: false
    };
    let referenceDataToastTimer = null;

    /**
     * 按角色取得一个静态展示节点。
     * @param {string} referenceDataRole - HTML 中 data-reference-data-role 的实际值。
     * @returns {Element|null} 当前页面对应节点。
     */
    function referenceDataRole(referenceDataRole) {
        // 所有角色查询限定在当前页面文档内，角色名由应用常量提供。
        return document.querySelector(`[data-reference-data-role='${referenceDataRole}']`);
    }

    /**
     * 创建带稳定类名和文字的 DOM 节点。
     * @param {string} referenceDataTag - 受控 HTML 标签名。
     * @param {string} referenceDataClassName - 当前应用 CSS 类名。
     * @param {string} referenceDataText - 后端返回或应用固定的可见文字。
     * @returns {HTMLElement} 未使用 innerHTML 的安全实时节点。
     */
    function referenceDataElement(referenceDataTag, referenceDataClassName, referenceDataText = "") {
        const referenceDataNode = document.createElement(referenceDataTag);
        if (referenceDataClassName) referenceDataNode.className = referenceDataClassName;
        referenceDataNode.textContent = referenceDataText ?? "";
        return referenceDataNode;
    }

    /**
     * 显示成功或错误反馈。
     * @param {string} referenceDataMessage - 后端安全消息或应用提示。
     * @param {boolean} referenceDataError - 是否使用错误视觉。
     * @returns {void}
     */
    function referenceDataShowToast(referenceDataMessage, referenceDataError = false) {
        // 新反馈覆盖旧定时器，连续操作时不会提前隐藏最新消息。
        window.clearTimeout(referenceDataToastTimer);
        referenceDataToast.textContent = referenceDataMessage;
        referenceDataToast.classList.toggle("reference-data-toast-error", referenceDataError);
        referenceDataToast.classList.add("reference-data-toast-visible");
        referenceDataToastTimer = window.setTimeout(() => {
            referenceDataToast.classList.remove("reference-data-toast-visible");
        }, 3200);
    }

    /**
     * 将数据库时间转换为紧凑本地显示。
     * @param {unknown} referenceDataValue - 后端 ISO LocalDateTime 字符串。
     * @returns {string} 例如 2026-08-07 08:10；无值返回短横线。
     */
    function referenceDataFormatTime(referenceDataValue) {
        if (!referenceDataValue) return "—";
        // Java LocalDateTime 使用 ISO 文本，管理列表只显示到分钟。
        return String(referenceDataValue).replace("T", " ").slice(0, 16);
    }

    /**
     * 根据后端类型记录创建一行实时表格节点。
     * @param {object} referenceDataRecord - 管理 API records 中的一条类型。
     * @returns {HTMLTableRowElement} 完整业务表格行。
     */
    function referenceDataBuildRow(referenceDataRecord) {
        const referenceDataRow = document.createElement("tr");
        referenceDataRow.dataset.referenceDataId = String(referenceDataRecord.id);

        // 项目编码和资源编码共同表达跨项目稳定坐标。
        const referenceDataCoordinateCell = document.createElement("td");
        const referenceDataCoordinate = referenceDataElement("div", "reference-data-coordinate");
        referenceDataCoordinate.append(
            referenceDataElement("strong", "", referenceDataRecord.resourceCode),
            referenceDataElement("span", "", referenceDataRecord.projectCode)
        );
        referenceDataCoordinateCell.append(referenceDataCoordinate);

        // 中文名称是当前管理页主展示名称。
        const referenceDataNameCell = referenceDataElement("td", "", referenceDataRecord.nameZh);

        // 英文和日文按固定两行展示，缺失值保持短横线而不改变行高。
        const referenceDataMultilingualCell = document.createElement("td");
        const referenceDataMultilingual = referenceDataElement("div", "reference-data-multilingual");
        referenceDataMultilingual.append(
            referenceDataElement("strong", "", referenceDataRecord.nameEn || "—"),
            referenceDataElement("span", "", referenceDataRecord.nameJa || "—")
        );
        referenceDataMultilingualCell.append(referenceDataMultilingual);

        // 输出形态使用稳定业务值，避免根据本地化名称判断 API 能力。
        const referenceDataShapeCell = document.createElement("td");
        referenceDataShapeCell.append(referenceDataElement("span", "reference-data-shape", referenceDataRecord.dataShape));

        // 状态 1/2 分别映射启用与停用，删除记录不会进入管理列表。
        const referenceDataStatusCell = document.createElement("td");
        const referenceDataStatusBadge = referenceDataElement(
            "span",
            `reference-data-status ${referenceDataRecord.status === 1 ? "reference-data-status-enabled" : "reference-data-status-disabled"}`,
            referenceDataRecord.status === 1 ? "已启用" : "已停用"
        );
        referenceDataStatusCell.append(referenceDataStatusBadge);

        const referenceDataSortCell = referenceDataElement("td", "", String(referenceDataRecord.sortnum ?? 0));
        const referenceDataUpdatedCell = referenceDataElement("td", "", referenceDataFormatTime(referenceDataRecord.updatedAt));

        // 行操作按钮只保存稳定主键，实际动作由应用事件委托处理。
        const referenceDataActionCell = document.createElement("td");
        const referenceDataActions = referenceDataElement("div", "reference-data-row-actions");
        const referenceDataEditButton = referenceDataElement("button", "", "✎");
        referenceDataEditButton.type = "button";
        referenceDataEditButton.title = "编辑类型";
        referenceDataEditButton.dataset.referenceDataAction = "edit";
        referenceDataEditButton.dataset.referenceDataId = String(referenceDataRecord.id);
        const referenceDataDeleteButton = referenceDataElement("button", "", "×");
        referenceDataDeleteButton.type = "button";
        referenceDataDeleteButton.title = "删除类型";
        referenceDataDeleteButton.dataset.referenceDataAction = "delete";
        referenceDataDeleteButton.dataset.referenceDataId = String(referenceDataRecord.id);
        referenceDataActions.append(referenceDataEditButton, referenceDataDeleteButton);
        referenceDataActionCell.append(referenceDataActions);

        referenceDataRow.append(
            referenceDataCoordinateCell,
            referenceDataNameCell,
            referenceDataMultilingualCell,
            referenceDataShapeCell,
            referenceDataStatusCell,
            referenceDataSortCell,
            referenceDataUpdatedCell,
            referenceDataActionCell
        );
        return referenceDataRow;
    }

    /**
     * 同步列表、统计和分页状态。
     * @param {object} referenceDataPage - 后端 CommonPageResult。
     * @returns {void}
     */
    function referenceDataRenderPage(referenceDataPage) {
        const referenceDataRecords = Array.isArray(referenceDataPage.records) ? referenceDataPage.records : [];
        referenceDataState.totalCount = Number(referenceDataPage.totalCount || 0);
        // 后端有序 records → 当前 tbody 的完整实时节点集合。
        referenceDataRows.replaceChildren(...referenceDataRecords.map(referenceDataBuildRow));
        referenceDataEmpty.hidden = referenceDataRecords.length > 0;
        referenceDataRole("type-count").textContent = String(referenceDataState.totalCount);
        referenceDataRole("summary").textContent = `共 ${referenceDataState.totalCount} 个类型`;
        referenceDataRole("current-page").textContent = String(referenceDataState.pageNo);
        const referenceDataPageCount = Math.max(1, Math.ceil(referenceDataState.totalCount / referenceDataState.pageSize));
        referenceDataRole("page-info").textContent = `第 ${referenceDataState.pageNo} / ${referenceDataPageCount} 页 · 每页 ${referenceDataState.pageSize} 条`;
        document.querySelector("[data-reference-data-action='previous']").disabled = referenceDataState.pageNo <= 1;
        document.querySelector("[data-reference-data-action='next']").disabled = referenceDataState.pageNo >= referenceDataPageCount;
    }

    /**
     * 从永久数据库加载当前筛选页。
     * @returns {Promise<void>} 请求完成后更新列表或显示安全错误。
     */
    async function referenceDataLoadPage() {
        if (referenceDataState.loading) return;
        referenceDataState.loading = true;
        referenceDataLoading.hidden = false;
        const referenceDataQuery = new URLSearchParams({
            pageNo: String(referenceDataState.pageNo),
            pageSize: String(referenceDataState.pageSize)
        });
        // 空筛选不进入 URL，后端按全部未删除类型处理。
        if (referenceDataKeyword.value.trim()) referenceDataQuery.set("keyword", referenceDataKeyword.value.trim());
        if (referenceDataStatus.value) referenceDataQuery.set("status", referenceDataStatus.value);
        try {
            // 显式 API 路径 → CommonPageResult，不使用模拟 JSON 或内存数据。
            const referenceDataPage = await referenceDataAjax.json({
                url: `${referenceDataTypeApi}?${referenceDataQuery.toString()}`
            });
            referenceDataRenderPage(referenceDataPage);
        } catch (referenceDataError) {
            referenceDataShowToast(referenceDataError.message || "类型目录读取失败。", true);
        } finally {
            referenceDataState.loading = false;
            referenceDataLoading.hidden = true;
        }
    }

    /**
     * 打开新增窗口并恢复表单默认值。
     * @returns {void}
     */
    function referenceDataOpenCreate() {
        referenceDataState.editingId = null;
        referenceDataForm.reset();
        referenceDataForm.elements.dataShape.value = "BOTH";
        referenceDataForm.elements.status.value = "1";
        referenceDataForm.elements.sortnum.value = "0";
        referenceDataRole("dialog-title").textContent = "新增类型";
        referenceDataDialog.showModal();
        referenceDataForm.elements.projectCode.focus();
    }

    /**
     * 读取真实详情并打开编辑窗口。
     * @param {number} referenceDataId - 数据库生成主键。
     * @returns {Promise<void>} 详情加载完成后显示窗口。
     */
    async function referenceDataOpenEdit(referenceDataId) {
        try {
            // 主键详情 API → 当前数据库最新类型记录。
            const referenceDataResult = await referenceDataAjax.request({
                url: `${referenceDataTypeApi}/${referenceDataId}`,
                method: "GET"
            });
            const referenceDataRecord = referenceDataResult.data;
            referenceDataState.editingId = referenceDataId;
            referenceDataForm.reset();
            // 固定表单字段逐项回填，未知响应字段不会进入表单或后续保存请求。
            [
                "projectCode", "resourceCode", "nameZh", "nameJa", "nameEn",
                "descriptionZh", "dataShape", "status", "sortnum"
            ].forEach((referenceDataField) => {
                if (referenceDataForm.elements[referenceDataField]) {
                    referenceDataForm.elements[referenceDataField].value = referenceDataRecord[referenceDataField] ?? "";
                }
            });
            referenceDataRole("dialog-title").textContent = "编辑类型";
            referenceDataDialog.showModal();
            referenceDataForm.elements.nameZh.focus();
        } catch (referenceDataError) {
            referenceDataShowToast(referenceDataError.message || "类型详情读取失败。", true);
        }
    }

    /**
     * 保存当前新增或编辑表单。
     * @param {SubmitEvent} referenceDataEvent - dialog 表单提交事件。
     * @returns {Promise<void>} 保存成功后关闭窗口并刷新当前页。
     */
    async function referenceDataSave(referenceDataEvent) {
        referenceDataEvent.preventDefault();
        if (!referenceDataForm.reportValidity()) return;
        // FormData 固定字段 → selAjax 通用表单请求数据。
        const referenceDataData = Object.fromEntries(new FormData(referenceDataForm).entries());
        const referenceDataUrl = referenceDataState.editingId
            ? `${referenceDataTypeApi}/${referenceDataState.editingId}`
            : referenceDataTypeApi;
        const referenceDataSubmitButton = referenceDataForm.querySelector("button[type='submit']");
        referenceDataSubmitButton.disabled = true;
        try {
            const referenceDataResult = await referenceDataAjax.request({
                url: referenceDataUrl,
                method: "POST",
                data: referenceDataData
            });
            referenceDataDialog.close();
            referenceDataShowToast(referenceDataResult.msg || "类型保存完成。");
            await referenceDataLoadPage();
        } catch (referenceDataError) {
            referenceDataShowToast(referenceDataError.message || "类型保存失败。", true);
        } finally {
            referenceDataSubmitButton.disabled = false;
        }
    }

    /**
     * 逻辑删除一条非内置类型。
     * @param {number} referenceDataId - 数据库生成主键。
     * @returns {Promise<void>} 删除完成后刷新当前页。
     */
    async function referenceDataDelete(referenceDataId) {
        // 第一版使用浏览器确认保护破坏性入口，后端仍执行内置类型保护和逻辑删除。
        if (!window.confirm("确定删除这个引用数据类型吗？已有记录将保留但不再出现在管理列表。")) return;
        try {
            const referenceDataResult = await referenceDataAjax.request({
                url: `${referenceDataTypeApi}/${referenceDataId}/delete`,
                method: "POST"
            });
            referenceDataShowToast(referenceDataResult.msg || "类型删除完成。");
            await referenceDataLoadPage();
        } catch (referenceDataError) {
            referenceDataShowToast(referenceDataError.message || "类型删除失败。", true);
        }
    }

    /**
     * 在当前主题内切换深浅模式，不改变业务筛选或编辑状态。
     * @returns {void}
     */
    function referenceDataToggleMode() {
        const referenceDataNextMode = referenceDataTheme.getState().mode === "dark" ? "light" : "dark";
        referenceDataTheme.setMode(referenceDataNextMode);
        referenceDataRole("mode-label").textContent = referenceDataNextMode === "dark" ? "浅色模式" : "深色模式";
    }

    // 背景控制器拥有当前页面的图片和显示参数，刷新后恢复晶透管理默认背景。
    const referenceDataBackgroundController = referenceDataPageBackground.mount(referenceDataBackgroundHost, {
        defaults: Object.freeze({ theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 })
    });
    if (!referenceDataBackgroundController) {
        throw new Error("引用数据管理后台背景控件挂载失败。");
    }
    // 个性化面板复用完整公共主题库；新增主题注册后无需修改本应用的选择界面。
    const referenceDataPersonalizationController = referenceDataPersonalization.mount(referenceDataPersonalizationHost, {
        backgroundController: referenceDataBackgroundController
    });
    if (!referenceDataPersonalizationController) {
        throw new Error("引用数据管理后台个性化控件挂载失败。");
    }
    // 主题库切换明暗模式时同步页头快捷按钮，不重新加载页面或业务数据。
    document.addEventListener("selTheme:change", (referenceDataThemeEvent) => {
        const referenceDataMode = referenceDataThemeEvent.detail?.mode || referenceDataTheme.getState().mode;
        referenceDataRole("mode-label").textContent = referenceDataMode === "dark" ? "浅色模式" : "深色模式";
    });

    // 页面范围内的标准下拉宿主由应用显式交给公共控件挂载。
    referenceDataDropdown.mountAll(referenceDataHost);
    // 点击动作通过 data 属性委托，新增按钮、分页和行按钮共享一个稳定入口。
    document.addEventListener("click", (referenceDataEvent) => {
        const referenceDataButton = referenceDataEvent.target.closest("[data-reference-data-action]");
        if (!referenceDataButton) return;
        const referenceDataAction = referenceDataButton.dataset.referenceDataAction;
        if (referenceDataAction === "create") referenceDataOpenCreate();
        if (referenceDataAction === "close") referenceDataDialog.close();
        if (referenceDataAction === "toggle-mode") referenceDataToggleMode();
        if (referenceDataAction === "search") {
            referenceDataState.pageNo = 1;
            referenceDataLoadPage();
        }
        if (referenceDataAction === "reset") {
            referenceDataKeyword.value = "";
            referenceDataDropdown.setValue(referenceDataStatus, "", true);
            referenceDataState.pageNo = 1;
            referenceDataLoadPage();
        }
        if (referenceDataAction === "previous" && referenceDataState.pageNo > 1) {
            referenceDataState.pageNo -= 1;
            referenceDataLoadPage();
        }
        if (referenceDataAction === "next") {
            const referenceDataPageCount = Math.max(1, Math.ceil(referenceDataState.totalCount / referenceDataState.pageSize));
            if (referenceDataState.pageNo < referenceDataPageCount) {
                referenceDataState.pageNo += 1;
                referenceDataLoadPage();
            }
        }
        if (referenceDataAction === "edit") referenceDataOpenEdit(Number(referenceDataButton.dataset.referenceDataId));
        if (referenceDataAction === "delete") referenceDataDelete(Number(referenceDataButton.dataset.referenceDataId));
    });
    // Enter 搜索与查询按钮使用相同加载入口。
    referenceDataKeyword.addEventListener("keydown", (referenceDataEvent) => {
        if (referenceDataEvent.key === "Enter") {
            referenceDataEvent.preventDefault();
            referenceDataState.pageNo = 1;
            referenceDataLoadPage();
        }
    });
    referenceDataForm.addEventListener("submit", referenceDataSave);
    // 首屏直接读取永久数据库，页面不包含模拟业务记录。
    referenceDataLoadPage();
})();
