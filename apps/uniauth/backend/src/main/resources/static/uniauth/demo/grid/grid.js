(function initializeGridDemo() {
    "use strict";

    // 固定项目数据复刻参考图中的六条可见记录，页面无需依赖后台即可稳定展示设计验收状态。
    const PROJECTS = Object.freeze([
        // 第一条记录展示进行中平台架构项目，并使用星标突出重点项目。
        { id: 1, name: "星河数据中台", type: "平台架构", owner: "林深", avatar: 12, status: "进行中", statusType: "active", progress: 68, updatedAt: "2024-05-21 14:35", symbol: "ri-flashlight-line", colors: ["#2447d8", "#712cff"], favorite: false, starred: true },
        // 第二条记录展示数据可视化项目，较低进度用于验证不同长度进度条。
        { id: 2, name: "极光可视化系统", type: "数据可视化", owner: "苏晚", avatar: 47, status: "进行中", statusType: "active", progress: 42, updatedAt: "2024-05-21 11:20", symbol: "ri-shape-2-line", colors: ["#147fdc", "#2744de"], favorite: false, starred: false },
        // 第三条记录是参考图默认选中项目，菜单初始锚定在该行操作按钮右侧。
        { id: 3, name: "量子计算实验平台", type: "科研项目", owner: "陆川", avatar: 32, status: "评审中", statusType: "review", progress: 78, updatedAt: "2024-05-20 16:40", symbol: "ri-box-3-line", colors: ["#1ec7bb", "#157d7c"], favorite: true, starred: false },
        // 第四条记录展示已完成项目和满进度绿色状态。
        { id: 4, name: "智慧城市数据大屏", type: "可视化", owner: "叶蓁", avatar: 44, status: "已完成", statusType: "done", progress: 100, updatedAt: "2024-05-19 09:15", symbol: "ri-focus-3-line", colors: ["#ef9a16", "#a6500b"], favorite: false, starred: false },
        // 第五条记录展示人工智能类型的第二个完成状态，用于验证连续完成行的视觉节奏。
        { id: 5, name: "AI 风控模型系统", type: "人工智能", owner: "周叙", avatar: 5, status: "已完成", statusType: "done", progress: 100, updatedAt: "2024-05-18 17:55", symbol: "ri-brain-line", colors: ["#dc2aad", "#831069"], favorite: false, starred: false },
        // 第六条记录展示归档状态，进度为空时使用破折号而不渲染进度条。
        { id: 6, name: "历史数据归档库", type: "数据归档", owner: "顾言", avatar: 11, status: "已归档", statusType: "archived", progress: null, updatedAt: "2024-05-15 13:30", symbol: "ri-archive-drawer-line", colors: ["#2789dd", "#15479d"], favorite: false, starred: false }
    ]);

    // 页面状态集中保存当前选择、菜单归属和分页位置，保证交互之间不会互相覆盖。
    const state = {
        // 参考图初始选择第三条量子计算项目。
        selectedIds: new Set([3]),
        // 分页初始位于第一页。
        currentPage: 1,
        // 页面默认显示十条记录。
        pageSize: 10
    };

    // 缓存表格和浮层固定节点，交互更新时避免重复查找页面结构。
    const view = {
        // 表格主体承接项目行的动态渲染。
        tableBody: document.querySelector("#project-table-body"),
        // 全选按钮同步全部项目的选择状态。
        selectAll: document.querySelector("#select-all"),
        // 每页条数选择器提供可见反馈。
        pageSize: document.querySelector("#page-size"),
        // Toast 区域展示菜单与分页动作结果。
        toast: document.querySelector("#toast")
    };

    // 记录 Toast 关闭计时器，连续操作时始终以最新提示为准。
    let toastTimer = 0;

    // 根据项目状态返回与参考图一致的 Remix 图标名称。
    function statusIcon(statusType) {
        // 进行中状态使用菱形进度标记。
        if (statusType === "active") {
            return "ri-checkbox-blank-circle-line";
        }
        // 评审中状态使用带圆心的流程标记。
        if (statusType === "review") {
            return "ri-record-circle-line";
        }
        // 已完成状态使用确认标记。
        if (statusType === "done") {
            return "ri-checkbox-circle-line";
        }
        // 已归档状态使用中性圆点标记。
        return "ri-circle-line";
    }

    // 创建图标节点时只接收图标库类名，避免用文字字符替代真实图标。
    function createIcon(className) {
        // 使用语义中性的 i 元素承载 Remix Icon 字体。
        const icon = document.createElement("i");
        // 写入已经由静态项目数据限定的图标库类名。
        icon.className = className;
        // 图标属于装饰信息，业务含义由相邻文字或按钮标签表达。
        icon.setAttribute("aria-hidden", "true");
        // 返回可直接插入组件的图标节点。
        return icon;
    }

    // 创建一个图标操作按钮，并把项目主键和动作写入可访问属性。
    function createActionButton(project, action, iconClass, label) {
        // 真实 button 保证键盘和辅助技术都能触发项目动作。
        const button = document.createElement("button");
        // 所有圆形操作按钮共享视觉类。
        button.className = "icon-button";
        // 按钮不参与任何外部表单提交。
        button.type = "button";
        // 项目主键用于事件委托确定动作目标。
        button.dataset.projectId = String(project.id);
        // 动作名称区分查看、编辑与更多菜单。
        button.dataset.action = action;
        // 可访问名称补足纯图标按钮的业务语义。
        button.setAttribute("aria-label", `${label}：${project.name}`);
        // 更多按钮同步菜单展开状态。
        if (action === "menu") {
            // 独立菜单控制器提供当前绑定项目，表格不再保存菜单内部状态。
            const activeMenuProjectId = window.gridMenu ? window.gridMenu.getProjectId() : null;
            // 展开属性只对当前菜单归属项目为真。
            button.setAttribute("aria-expanded", String(activeMenuProjectId === project.id));
            // 当前菜单锚点使用高亮圆形底板。
            button.classList.toggle("is-active", activeMenuProjectId === project.id);
        }
        // 图标库节点放入按钮作为可见内容。
        button.appendChild(createIcon(iconClass));
        // 返回完整操作按钮。
        return button;
    }

    // 创建项目行并按参考图的八列结构填充真实可交互内容。
    function createProjectRow(project) {
        // 每条项目数据对应一个可选择的表格行。
        const row = document.createElement("tr");
        // 主键用于选择交互和操作菜单定位。
        row.dataset.projectId = String(project.id);
        // 当前被选中的项目行获得蓝紫色发光背景。
        row.classList.toggle("is-selected", state.selectedIds.has(project.id));

        // 第一列承载单行选择按钮。
        const checkCell = document.createElement("td");
        // 复用表头相同的左侧对齐规则。
        checkCell.className = "check-cell";
        // 真实按钮模拟参考图方形复选框并支持键盘操作。
        const checkbox = document.createElement("button");
        // 复选框视觉由统一类控制。
        checkbox.className = "table-checkbox";
        // 防止按钮触发表单提交。
        checkbox.type = "button";
        // 角色明确告诉辅助技术这是复选控件。
        checkbox.setAttribute("role", "checkbox");
        // 当前选择状态与页面状态集合保持一致。
        checkbox.setAttribute("aria-checked", String(state.selectedIds.has(project.id)));
        // 可访问名称携带项目名称。
        checkbox.setAttribute("aria-label", `选择项目：${project.name}`);
        // 动作和主键交给表格事件委托处理。
        checkbox.dataset.action = "select";
        checkbox.dataset.projectId = String(project.id);
        // 复选控件加入首列。
        checkCell.appendChild(checkbox);

        // 第二列组合项目彩色符号、名称和星标。
        const projectCell = document.createElement("td");
        // 内部弹性布局保持符号和名称垂直居中。
        const projectLayout = document.createElement("div");
        // 项目主列共享参考图水平间距。
        projectLayout.className = "project-cell";
        // 彩色符号使用项目状态色生成独立视觉识别。
        const symbol = document.createElement("span");
        // 符号容器负责参考图中的霓虹方形底座。
        symbol.className = "project-symbol";
        // 两个项目色写成 CSS 变量供皮肤层生成一致渐变。
        symbol.style.setProperty("--symbol-start", project.colors[0]);
        symbol.style.setProperty("--symbol-end", project.colors[1]);
        // 每个项目使用真实图标库中的对应业务图标。
        symbol.appendChild(createIcon(project.symbol));
        // 名称区域保持长项目名可截断。
        const nameLayout = document.createElement("span");
        // 名称与星标共享水平排列。
        nameLayout.className = "project-name";
        // 项目名称是该行主要文本。
        const projectName = document.createElement("strong");
        // 使用 textContent 防止数据内容被解释成 HTML。
        projectName.textContent = project.name;
        // 名称加入文字区域。
        nameLayout.appendChild(projectName);
        // 参考图仅在部分项目名称后展示收藏或关注标记。
        if (project.starred || project.favorite) {
            // 星标使用图标库资产，不使用 Unicode 字符替代。
            const star = createIcon(project.favorite ? "ri-star-fill" : "ri-star-line");
            // 收藏项目使用黄色强调，关注项目使用蓝色强调。
            star.classList.toggle("is-favorite", project.favorite);
            // 星标加入名称尾部。
            nameLayout.appendChild(star);
        }
        // 项目符号和名称按参考图顺序加入布局。
        projectLayout.append(symbol, nameLayout);
        // 完整项目布局加入第二列。
        projectCell.appendChild(projectLayout);

        // 第三列直接展示项目类型。
        const typeCell = document.createElement("td");
        // 类型文本来自固定项目数据。
        typeCell.textContent = project.type;

        // 第四列组合真实头像图片、负责人姓名和首行认证标记。
        const ownerCell = document.createElement("td");
        // 负责人列使用紧凑弹性布局。
        const ownerLayout = document.createElement("div");
        // 头像与姓名保持参考图中的九像素间距。
        ownerLayout.className = "owner-cell";
        // 头像使用远程头像服务提供真实人物照片，避免占位字母或 CSS 人像。
        const avatar = document.createElement("img");
        // 头像视觉类负责圆形裁切与边框。
        avatar.className = "owner-avatar";
        // 固定编号保证每次打开都得到同一负责人照片。
        avatar.src = `https://i.pravatar.cc/80?img=${project.avatar}`;
        // 图片替代文本表达负责人身份。
        avatar.alt = `${project.owner}的头像`;
        // 明确尺寸降低图片加载时的布局抖动。
        avatar.width = 39;
        // 明确高度保持头像为正圆。
        avatar.height = 39;
        // 姓名文本单独承载便于窄屏处理。
        const ownerName = document.createElement("span");
        // 负责人姓名使用稳定视觉类。
        ownerName.className = "owner-name";
        // 负责人姓名来自项目数据。
        ownerName.textContent = project.owner;
        // 头像和姓名依次加入负责人布局。
        ownerLayout.append(avatar, ownerName);
        // 第一位负责人显示参考图中的蓝色认证徽标。
        if (project.id === 1) {
            // 徽标是状态装饰，不替代负责人姓名。
            const badge = document.createElement("span");
            // 小型蓝色圆形徽标与头像保持同一基线。
            badge.className = "owner-badge";
            // 图标库的认证图标提供真实视觉资产。
            badge.appendChild(createIcon("ri-verified-badge-fill"));
            // 徽标加入负责人姓名之后。
            ownerLayout.appendChild(badge);
        }
        // 完整负责人布局加入第四列。
        ownerCell.appendChild(ownerLayout);

        // 第五列展示带状态色和发光边框的胶囊标签。
        const statusCell = document.createElement("td");
        // 状态胶囊使用类型类控制蓝、紫、绿和中性色。
        const statusPill = document.createElement("span");
        // 状态类型只来自固定枚举，安全映射到 CSS 类。
        statusPill.className = `status-pill status--${project.statusType}`;
        // 状态前置图标与文字共同表达业务阶段。
        statusPill.append(createIcon(statusIcon(project.statusType)), document.createTextNode(project.status));
        // 完整状态组件加入第五列。
        statusCell.appendChild(statusPill);

        // 第六列展示百分比与霓虹进度轨道。
        const progressCellElement = document.createElement("td");
        // 进度为 null 时只显示破折号。
        if (project.progress === null) {
            // 破折号与参考图归档行一致。
            progressCellElement.textContent = "—";
        } else {
            // 进度布局垂直排列数字和轨道。
            const progressLayout = document.createElement("div");
            // 满进度项目切换绿色皮肤。
            progressLayout.className = `progress-cell${project.progress === 100 ? " is-complete" : ""}`;
            // 百分比文本放在轨道上方。
            const progressValue = document.createElement("span");
            // 百分比视觉类保持与正文区分。
            progressValue.className = "progress-value";
            // 百分比数据转换成参考图显示格式。
            progressValue.textContent = `${project.progress}%`;
            // 轨道承载实际宽度变化。
            const progressTrack = document.createElement("span");
            // 统一深色背景轨道。
            progressTrack.className = "progress-track";
            // 进度条以业务百分比控制宽度。
            const progressBar = document.createElement("span");
            // 发光填充条共享皮肤。
            progressBar.className = "progress-bar";
            // CSS 变量直接接收已验证的 0 到 100 数值。
            progressBar.style.setProperty("--progress", `${project.progress}%`);
            // 辅助技术读取真实进度语义。
            progressTrack.setAttribute("role", "progressbar");
            // 当前进度值用于屏幕阅读器播报。
            progressTrack.setAttribute("aria-valuenow", String(project.progress));
            // 进度最小值固定为零。
            progressTrack.setAttribute("aria-valuemin", "0");
            // 进度最大值固定为一百。
            progressTrack.setAttribute("aria-valuemax", "100");
            // 填充条加入轨道。
            progressTrack.appendChild(progressBar);
            // 百分比和轨道加入进度布局。
            progressLayout.append(progressValue, progressTrack);
            // 完整进度布局加入第六列。
            progressCellElement.appendChild(progressLayout);
        }

        // 第七列展示参考图中的固定更新时间。
        const timeCell = document.createElement("td");
        // 时间文本保持年月日和分钟精度。
        timeCell.textContent = project.updatedAt;

        // 第八列提供查看、编辑和更多操作三个可交互按钮。
        const actionsCell = document.createElement("td");
        // 操作按钮使用水平圆形布局。
        const actions = document.createElement("div");
        // 操作组统一间距和点击区域。
        actions.className = "action-group";
        // 三个按钮对应参考图的眼睛、编辑和省略号动作。
        actions.append(
            createActionButton(project, "view", "ri-eye-line", "查看项目"),
            createActionButton(project, "edit", "ri-edit-line", "编辑项目"),
            createActionButton(project, "menu", "ri-more-fill", "更多操作")
        );
        // 完整操作组加入最后一列。
        actionsCell.appendChild(actions);

        // 八列按参考图顺序一次加入项目行。
        row.append(checkCell, projectCell, typeCell, ownerCell, statusCell, progressCellElement, timeCell, actionsCell);
        // 返回已经完成的项目行供表格一次渲染。
        return row;
    }

    // 根据当前状态重新渲染六条项目记录，并同步全选和菜单视觉。
    function renderTable() {
        // 文档片段减少逐行插入引起的重复布局计算。
        const fragment = document.createDocumentFragment();
        // 每条项目记录生成完整交互行。
        PROJECTS.forEach((project) => fragment.appendChild(createProjectRow(project)));
        // 一次替换旧表格内容，确保状态与视觉完全同步。
        view.tableBody.replaceChildren(fragment);
        // 全部六条都被选中时才把表头复选框标记为选中。
        view.selectAll.setAttribute("aria-checked", String(state.selectedIds.size === PROJECTS.length));
    }

    // 独立菜单状态变化后只同步更多按钮，不重绘整个表格。
    function syncMenuButtonStates() {
        // 读取菜单当前绑定项目，关闭时得到 null。
        const activeMenuProjectId = window.gridMenu ? window.gridMenu.getProjectId() : null;
        // 当前页面所有更多按钮逐个同步展开语义和高亮。
        view.tableBody.querySelectorAll('button[data-action="menu"]').forEach((button) => {
            // 按钮项目主键转换为数字后与菜单归属比较。
            const isActive = Number(button.dataset.projectId) === activeMenuProjectId;
            // aria-expanded 为键盘和辅助技术表达真实状态。
            button.setAttribute("aria-expanded", String(isActive));
            // is-active 控制当前行更多按钮的视觉高亮。
            button.classList.toggle("is-active", isActive);
        });
    }

    // 显示短时业务反馈，让视觉演示中的按钮不是静态摆设。
    function showToast(message) {
        // 取消上一条提示的关闭计时，避免新提示被旧计时器提前隐藏。
        window.clearTimeout(toastTimer);
        // 写入当前动作说明。
        view.toast.textContent = message;
        // 显示带霓虹边框的提示浮层。
        view.toast.classList.add("is-visible");
        // 两秒后自动收起提示，保持表格视野整洁。
        toastTimer = window.setTimeout(() => view.toast.classList.remove("is-visible"), 2000);
    }

    // 表格事件委托统一处理选择、查看、编辑和更多菜单。
    view.tableBody.addEventListener("click", (event) => {
        // 只接受带业务动作的按钮点击。
        const button = event.target.closest("button[data-action]");
        // 点击普通单元格时不改变当前状态。
        if (!button) {
            return;
        }
        // 把按钮上的项目主键转换成固定数据中的数字标识。
        const projectId = Number(button.dataset.projectId);
        // 找到对应项目用于提示真实名称。
        const project = PROJECTS.find((item) => item.id === projectId);
        // 找不到项目说明页面结构已失配，安全终止当前动作。
        if (!project) {
            return;
        }
        // 单行选择动作切换集合中的项目主键。
        if (button.dataset.action === "select") {
            // 已选项目再次点击时取消选择。
            if (state.selectedIds.has(projectId)) {
                state.selectedIds.delete(projectId);
            } else {
                // 未选项目点击后加入选择集合。
                state.selectedIds.add(projectId);
            }
            // 选择变化后重绘表格以同步行背景和复选框。
            renderTable();
            // 选择动作结束后不继续触发其他按钮逻辑。
            return;
        }
        // 更多动作在同一按钮上再次点击时关闭菜单。
        if (button.dataset.action === "menu") {
            // 独立菜单控制器接收项目主键和名称，内部处理打开、关闭和切换。
            window.gridMenu.toggle({ projectId, projectName: project.name });
            // 同步全部更多按钮的展开状态。
            syncMenuButtonStates();
            // 更多动作结束后不显示通用操作提示。
            return;
        }
        // 查看和编辑按钮展示带项目名称的操作反馈。
        showToast(`${button.dataset.action === "view" ? "查看" : "编辑"}：${project.name}`);
    });

    // 表头全选按钮在全部选中和全部取消之间切换。
    view.selectAll.addEventListener("click", () => {
        // 全部项目已经选中时清空选择集合。
        if (state.selectedIds.size === PROJECTS.length) {
            state.selectedIds.clear();
        } else {
            // 否则把当前六条项目全部加入选择集合。
            PROJECTS.forEach((project) => state.selectedIds.add(project.id));
        }
        // 全选状态变化后重新渲染所有行和表头控件。
        renderTable();
    });

    // 页码区域通过事件委托处理数字页和前后翻页。
    document.querySelector(".pagination").addEventListener("click", (event) => {
        // 仅响应分页按钮点击。
        const button = event.target.closest("button");
        // 非按钮区域不改变分页状态。
        if (!button) {
            return;
        }
        // 数字页按钮直接读取目标页码。
        if (button.dataset.page) {
            state.currentPage = Number(button.dataset.page);
        }
        // 上一页动作保证页码不低于第一页。
        if (button.dataset.pageAction === "previous") {
            state.currentPage = Math.max(1, state.currentPage - 1);
        }
        // 下一页动作保证页码不超过参考图总页数十三。
        if (button.dataset.pageAction === "next") {
            state.currentPage = Math.min(13, state.currentPage + 1);
        }
        // 所有可见数字按钮同步当前页视觉。
        document.querySelectorAll(".page-button[data-page]").forEach((pageButton) => {
            // 当前页按钮获得发光紫色背景。
            pageButton.classList.toggle("is-current", Number(pageButton.dataset.page) === state.currentPage);
            // 只有当前页保留 aria-current。
            if (Number(pageButton.dataset.page) === state.currentPage) {
                pageButton.setAttribute("aria-current", "page");
            } else {
                pageButton.removeAttribute("aria-current");
            }
        });
        // 用户得到当前分页位置反馈。
        showToast(`已切换到第 ${state.currentPage} 页`);
    });

    // 每页条数改变后保存展示偏好并给出明确反馈。
    view.pageSize.addEventListener("change", () => {
        // 将选择器字符串值转换成业务数值。
        state.pageSize = Number(view.pageSize.value);
        // 提示当前页面容量设置。
        showToast(`每页显示 ${state.pageSize} 条项目`);
    });

    // 独立菜单广播动作后展示当前项目和所选动作，证明一级与二级项目都可用。
    document.addEventListener("gridmenu:action", (event) => {
        // 事件携带菜单配置和当前项目。
        const detail = event.detail;
        // 缺少项目时不显示无归属反馈。
        if (!detail || !detail.project) {
            return;
        }
        // 二级动作使用父动作语义前缀，一级动作直接展示名称。
        const actionLabel = detail.level === "secondary" ? `移动到 · ${detail.label}` : detail.label;
        // Toast 展示真实动作和当前项目名称。
        showToast(`${actionLabel}：${detail.project.projectName}`);
    });

    // 独立菜单打开或关闭时同步表格更多按钮的可访问状态。
    document.addEventListener("gridmenu:openchange", () => {
        // 不重绘表格，仅更新三个更多按钮属性。
        syncMenuButtonStates();
    });

    // 页面首次加载立即渲染参考图默认状态。
    renderTable();
    // 默认把菜单绑定到第三行量子计算项目，便于直接检查长列表与滚动状态。
    window.gridMenu.open({ projectId: 3, projectName: "量子计算实验平台" });
    // 初始打开后同步第三行更多按钮高亮。
    syncMenuButtonStates();
})();
