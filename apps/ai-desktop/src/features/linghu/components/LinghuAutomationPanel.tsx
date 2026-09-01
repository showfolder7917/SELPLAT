// React 的表单事件类型保证保存动作可以明确阻止浏览器默认提交；状态 Hook 保存用户尚未提交的草稿。
import { type FormEvent, useState } from "react";
// 新增图标表达“创建启动文案”，保护图标表达令狐作为自动流程最后保障的业务身份。
import { Add24Regular, ShieldCheckmark24Regular } from "@fluentui/react-icons";

// 页面只消费跨进程公开协议，不直接依赖 Electron 主进程中的令狐实现。
import type { LinghuAutomationStateOutDto, LinghuStartupPromptOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
// 删除文案必须复用 SEL UI 的确认窗口，避免浏览器原生弹窗破坏统一交互。
import { useSelUi } from "../../../theme/SelUiProvider";

/**
 * 显示并维护令狐自动保障状态和启动文案。
 *
 * 真实传参示例：`{ state: linghuState, locale: "zh-CN", onState: setLinghuState }`。
 * 真实返回示例：返回自动保障开关、循环状态和文案管理面板。
 * 异常或副作用示例：按钮通过 `window.desktop` 调用主进程；调用失败只显示错误，不伪造成功状态。
 */
export function LinghuAutomationPanel({ state, locale, onState }: {
  // `state` 是主进程推送的权威快照，页面不能自行推进循环或恢复次数。
  state: LinghuAutomationStateOutDto;
  // `locale` 决定中文或日文显示，不改变令狐业务状态。
  locale: LocaleValue;
  // `onState` 把主进程返回的新快照交回页面上层保存。
  onState(state: LinghuAutomationStateOutDto): void;
}) {
  // 获取统一确认窗口，删除文案前必须由用户明确确认。
  const selUi = useSelUi();
  // `new` 表示新增，真实 ID 表示编辑，`null` 表示当前没有打开编辑表单。
  const [editingPromptId, setEditingPromptId] = useState<string | "new" | null>(null);
  // 标题和正文独立保存，避免用户输入过程中直接污染主进程权威状态。
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  // 页面错误只用于本次交互回显，下一次成功操作会主动清空。
  const [error, setError] = useState("");
  // 存在活动任务时显示“执行中”，但不因此禁用自动保障开关。
  const busyTask = state.activeTaskId !== null;

  /** 打开新增或编辑表单，并用所选文案初始化草稿。 */
  const beginEdit = (prompt?: LinghuStartupPromptOutDto) => {
    // 编辑已有文案时保存其稳定 ID；没有传入文案时进入新增模式。
    setEditingPromptId(prompt?.promptId || "new");
    // 新增模式使用空值，编辑模式复制当前快照供用户修改。
    setDraftTitle(prompt?.title || "");
    setDraftContent(prompt?.content || "");
    // 打开新一轮编辑时清除上一轮错误，避免错误提示误归属。
    setError("");
  };

  /** 保存当前草稿；新增和修改都只通过类型化 DesktopApi 完成。 */
  const savePrompt = async (event: FormEvent) => {
    // 阻止表单刷新整个 Electron 页面，保留当前协作状态和用户上下文。
    event.preventDefault();
    // 没有编辑目标代表表单已经关闭，迟到事件不应再次写入。
    if (!editingPromptId) return;
    try {
      // 新增调用创建接口；已有 ID 调用更新接口，页面不直接改写数组。
      const next = editingPromptId === "new"
        ? await window.desktop?.createLinghuStartupPrompt({ title: draftTitle, content: draftContent })
        : await window.desktop?.updateLinghuStartupPrompt(editingPromptId, { title: draftTitle, content: draftContent });
      // 网页预览可能没有 DesktopApi；只有取得主进程快照时才更新页面。
      if (next) onState(next);
      // 成功后关闭编辑区，并清除可能残留的旧错误。
      setEditingPromptId(null);
      setError("");
    } catch (reason) {
      // IPC 错误先去掉 Electron 包装前缀，再提供用户能理解的兜底文字。
      setError(readableDesktopError(reason, locale === "ja" ? "起動文を保存できません。" : "无法保存启动文案。"));
    }
  };

  /** 执行一个返回令狐状态的桌面操作，并统一处理网页预览和 IPC 异常。 */
  const apply = async (operation: Promise<LinghuAutomationStateOutDto> | undefined) => {
    try {
      // 缺少 DesktopApi 表示当前是只读网页预览，必须明确阻止假成功。
      if (!operation) throw new Error(locale === "ja" ? "Webプレビューは読み取り専用です。デスクトップアプリで変更してください。" : "网页预览为只读，请在桌面程序中修改。");
      // 主进程完成持久化后返回权威快照，页面只接受这一结果。
      const next = await operation;
      if (next) onState(next);
      // 成功意味着本轮错误已经恢复，立即清空提示。
      setError("");
    } catch (reason) {
      // 所有开关、选择和启停操作共享同一种错误回显格式。
      setError(readableDesktopError(reason, locale === "ja" ? "自動保障設定を更新できません。" : "无法更新自动保障设置。"));
    }
  };

  /** 删除文案前显示明确名称，防止用户误删相邻记录。 */
  const deletePrompt = async (prompt: LinghuStartupPromptOutDto) => {
    // 危险操作使用正式 SEL UI 确认窗口，并把标题作为确认目标展示。
    const confirmed = await selUi.confirm({ title: locale === "ja" ? "起動文を削除" : "删除启动文案", message: locale === "ja" ? `「${prompt.title}」を削除しますか？` : `确定删除启动文案“${prompt.title}”吗？`, target: prompt.title, tone: "danger" });
    // 用户取消时不调用主进程；确认后仍复用统一状态操作包装。
    if (confirmed) await apply(window.desktop?.deleteLinghuStartupPrompt(prompt.promptId));
  };

  // 面板只展示和提交意图；检测、恢复、持久化和测试全部留在主进程令狐模块。
  return <section className="linghu-automation" aria-label={locale === "ja" ? "自動運行の最終保障" : "自动运行最后保障"}>
    {/* 标题区同时展示令狐职责和唯一自动执行开关。 */}
    <header>
      <div><ShieldCheckmark24Regular /><div><h2>{locale === "ja" ? "自動運行の最終保障" : "自动运行最后保障"}</h2><p>{locale === "ja" ? "有効中は30秒ごとの検査を停止しません。" : "开启后每30秒持续检测，永远不会自行停止。"}</p></div></div>
      <button type="button" className="selswitch linghu-automation-toggle" role="switch" aria-checked={state.enabled} onClick={() => void apply(window.desktop?.setLinghuAutomationEnabled(!state.enabled))}><span className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></span>{state.enabled ? (locale === "ja" ? "自動実行中" : "自动执行中") : (locale === "ja" ? "自動実行を開始" : "开启自动执行")}</button>
    </header>
    {/* 事实区只读取主进程快照，避免页面根据文字猜测业务阶段。 */}
    <div className="linghu-automation-facts">
      <span>{locale === "ja" ? "サイクル" : "循环"}<strong>{state.cycle}</strong></span>
      <span>{locale === "ja" ? "現在のモジュール" : "当前模块"}<strong>{linghuModuleLabel(state.currentModule, locale)}</strong></span>
      <span>{locale === "ja" ? "実行状態" : "执行状态"}<strong>{busyTask ? (locale === "ja" ? "処理中" : "执行中") : state.enabled ? (locale === "ja" ? "次回検査待ち" : "等待下一次检测") : (locale === "ja" ? "停止" : "未开启")}</strong></span>
      <span>{locale === "ja" ? "最終検査" : "最后检测"}<strong>{formatLinghuTime(state.lastCheckedAt, locale)}</strong></span>
    </div>
    {/* 阻塞原因来自主进程恢复判断，页面必须原样保留业务事实。 */}
    {state.blockingReason && <p className="linghu-automation-notice" role="status">{state.blockingReason}</p>}
    {/* 上一模块反馈默认折叠，避免长文本遮挡当前操作。 */}
    {state.lastFeedback && <details className="linghu-last-feedback"><summary>{locale === "ja" ? "前回のフィードバック" : "上一模块反馈"}</summary><div><strong>{linghuModuleLabel(state.lastFeedback.module, locale)}</strong><p>{state.lastFeedback.summary}</p></div></details>}
    {/* 文案区提供新增入口；真正的长度校验和原子保存仍由 Store 负责。 */}
    <div className="linghu-prompt-heading"><div><h3>{locale === "ja" ? "起動文一覧" : "启动文案列表"}</h3><p>{locale === "ja" ? "追加・編集・削除・有効化ができます。" : "可新增、修改、删除、启停并选择当前文案。"}</p></div><button type="button" onClick={() => beginEdit()}><Add24Regular />{locale === "ja" ? "追加" : "新增启动文案"}</button></div>
    {/* 只有明确进入编辑状态时才挂载表单，关闭后草稿不会继续触发提交。 */}
    {editingPromptId && <form className="linghu-prompt-form" onSubmit={(event) => void savePrompt(event)}>
      <label>{locale === "ja" ? "名称" : "文案名称"}<input value={draftTitle} maxLength={80} onChange={(event) => setDraftTitle(event.target.value)} autoFocus /></label>
      <label>{locale === "ja" ? "内容" : "启动内容"}<textarea value={draftContent} maxLength={20_000} rows={12} onChange={(event) => setDraftContent(event.target.value)} /></label>
      <div><button type="button" onClick={() => setEditingPromptId(null)}>{locale === "ja" ? "キャンセル" : "取消"}</button><button type="submit" className="primary">{locale === "ja" ? "保存" : "保存文案"}</button></div>
    </form>}
    {/* 每条文案只呈现主进程状态允许的操作，当前文案无需重复显示“设为当前”。 */}
    <div className="linghu-prompt-list">{state.prompts.length === 0 ? <p className="linghu-prompt-empty">{locale === "ja" ? "起動文がありません。検査は継続し、追加を待ちます。" : "暂无启动文案；检测仍保持运行，等待新增。"}</p> : state.prompts.map((prompt) => <article key={prompt.promptId} className={`${state.activePromptId === prompt.promptId ? "active" : ""} ${prompt.enabled ? "" : "disabled"}`}>
      <div className="linghu-prompt-summary"><div><strong>{prompt.title}</strong><span>{state.activePromptId === prompt.promptId ? (locale === "ja" ? "現在使用中" : "当前使用") : prompt.enabled ? (locale === "ja" ? "有効" : "已启用") : (locale === "ja" ? "無効" : "已停用")}</span></div><p>{prompt.content}</p></div>
      <nav>
        {prompt.enabled && state.activePromptId !== prompt.promptId && <button type="button" onClick={() => void apply(window.desktop?.selectLinghuStartupPrompt(prompt.promptId))}>{locale === "ja" ? "使用" : "设为当前"}</button>}
        <button type="button" onClick={() => void apply(window.desktop?.updateLinghuStartupPrompt(prompt.promptId, { enabled: !prompt.enabled }))}>{prompt.enabled ? (locale === "ja" ? "無効化" : "停用") : (locale === "ja" ? "有効化" : "启用")}</button>
        <button type="button" onClick={() => beginEdit(prompt)}>{locale === "ja" ? "編集" : "修改"}</button>
        <button type="button" className="danger" onClick={() => void deletePrompt(prompt)}>{locale === "ja" ? "削除" : "删除"}</button>
      </nav>
    </article>)}</div>
    {/* 错误与操作区相邻显示，并使用 alert 让辅助技术及时读取。 */}
    {error && <p className="task-detail-error" role="alert">{error}</p>}
  </section>;
}

/** 把稳定模块编码翻译成人能理解的名称，不参与业务状态判断。 */
function linghuModuleLabel(module: LinghuAutomationStateOutDto["currentModule"], locale: LocaleValue): string {
  // 编码到双语名称的映射固定在令狐页面模块内，避免 Developer 壳层散落人物文案。
  const labels = {
    "flow-completion": { ja: "自動フロー完遂", "zh-CN": "自动流程完成保障" },
    "test-coverage": { ja: "テスト漏れと能力改善", "zh-CN": "测试漏点与能力升级" },
    "audit-completeness": { ja: "監査ログ完全性", "zh-CN": "日志审计完整性" },
  } as const;
  // `LocaleValue` 与映射键一致，因此可以直接返回当前语言文本。
  return labels[module][locale];
}

/** 格式化令狐最后检查时间；空值明确表示仍在等待第一轮检查。 */
function formatLinghuTime(value: string | null, locale: LocaleValue): string {
  // 空时间不是错误，而是自动保障尚未产生检查事实。
  if (!value) return locale === "ja" ? "進行中" : "进行中";
  // 先解析 ISO 时间，损坏的历史值保留原文，方便用户和开发者排查。
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  // 显示到秒，便于核对固定轮询是否继续运行。
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(parsed);
}

/** 去掉 Electron IPC 包装前缀，让用户看到真正的业务错误。 */
function readableDesktopError(reason: unknown, fallback: string): string {
  // Error 保留真实 message，非 Error 值使用调用场景提供的安全兜底。
  const message = reason instanceof Error ? reason.message : fallback;
  // Electron 的固定前缀对用户没有帮助，只移除包装而不吞掉后端详情。
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}
