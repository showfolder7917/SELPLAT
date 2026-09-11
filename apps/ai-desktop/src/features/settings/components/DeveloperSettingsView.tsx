import {
  Add24Regular,
  Delete16Regular,
  Delete24Regular,
  FolderOpen24Regular,
  ShieldLock16Filled,
  ShieldLock16Regular,
  Star16Filled,
  Star16Regular,
} from "@fluentui/react-icons";

import { RuleManagementFeature } from "../../rules";
import { ChatGPTLoginAction } from "../../shell";
import type { DeveloperSettingsViewModel } from "../model/createDeveloperSettingsViewModel";
import { SettingsFloatingPanel } from "./SettingsFloatingPanel";

type DeveloperSettingsViewProps = {
  /** 设置显示模型已经包含最终文案、状态和窄事件。 */
  viewModel: DeveloperSettingsViewModel;
};

/** 设置浮层的纯 View，不读取业务 Controller 或 Desktop API。 */
export function DeveloperSettingsView({ viewModel }: DeveloperSettingsViewProps) {
  const { account, testData, model, corpus, preferences, workspaces, diagnostics } = viewModel;

  return (
    <SettingsFloatingPanel
      locale={viewModel.panel.locale}
      open={viewModel.panel.open}
      onOpenChange={viewModel.panel.onOpenChange}
    >
      {/* 账号区显示当前身份、Codex 来源和登录动作。 */}
      <div className="dev-account">
        <span>{account.label}</span>
        <strong>{account.identity}</strong>
        <small>{account.runtimeDescription}</small>
        {account.authenticated
          ? <button type="button" onClick={account.onLogout}><span>{account.signOutLabel}</span></button>
          : <ChatGPTLoginAction label={account.signInLabel} onLogin={account.onLogin} />}
        {account.loginHint && <em>{account.loginHint}</em>}
      </div>

      {/* 测试数据清空是重启级危险操作，固定放在账号卡片后。 */}
      <div className="temp-card test-data-reset-card">
        <span>{testData.title}</span>
        <strong>{testData.summary}</strong>
        <small>{testData.detail}</small>
        {testData.error && <em role="alert">{testData.error}</em>}
        <div>
          <button className="danger" disabled={testData.busy} onClick={testData.onClear}>
            <Delete24Regular />
            {testData.actionLabel}
          </button>
        </div>
      </div>

      {/* 全局模型配置对所有主会话和协作任务共同生效。 */}
      <section className="model-settings-card" aria-labelledby="global-model-settings-title">
        <header>
          <div>
            <span id="global-model-settings-title">{model.title}</span>
            <small>{model.summary}</small>
          </div>
          <strong>{model.selectedModelName}</strong>
        </header>
        {model.modelCatalogStatus && <small role="status">{model.modelCatalogStatus}</small>}
        <label>
          <span>{model.defaultModelLabel}</span>
          <select
            aria-label={model.defaultModelLabel}
            value={model.defaultModel}
            disabled={model.modelCatalogLoading}
            onChange={(event) => model.onDefaultModelChange(event.target.value)}
          >
            <option value="">{model.defaultOptionLabel}</option>
            {model.defaultModel && !model.includesConfiguredModel && (
              <option value={model.defaultModel}>{model.defaultModel}</option>
            )}
            {model.models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}{item.provider ? ` · ${item.provider}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{model.effortLabel}</span>
          <select
            aria-label={model.effortLabel}
            value={model.reasoningEffort}
            disabled={model.modelCatalogLoading || model.supportedEfforts.length === 0}
            onChange={(event) => model.onReasoningEffortChange(event.target.value)}
          >
            <option value="">{model.effortDefaultLabel}</option>
            {model.supportedEfforts.map((effort) => (
              <option key={effort.value} value={effort.value}>{effort.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{model.speedLabel}</span>
          <select
            aria-label={model.speedLabel}
            value={model.serviceTier}
            onChange={(event) => model.onServiceTierChange(event.target.value)}
          >
            <option value="default">{model.standardSpeedLabel}</option>
            <option value="fast" disabled={!model.fastServiceTierSupported}>{model.fastSpeedLabel}</option>
          </select>
        </label>
        {model.modelUnavailableError && <em role="alert">{model.modelUnavailableError}</em>}
        {model.speedUnavailableError && <em role="alert">{model.speedUnavailableError}</em>}
        {model.description && <small>{model.description}</small>}
        {model.settingsError && <em role="alert">{model.settingsError}</em>}
      </section>

      {/* 语料区控制已完成 Codex 对话是否进入训练语料及历史补录。 */}
      <div className="temp-card corpus-ingestion-card">
        <span>{corpus.title}</span>
        <strong>{corpus.stateLabel}</strong>
        <small>{corpus.detail}</small>
        {corpus.statusMessage && (
          <em role="status">
            {corpus.statusMessage}{corpus.statusProgress ? ` · ${corpus.statusProgress}` : ""}
          </em>
        )}
        <div>
          <button type="button" aria-pressed={corpus.ingestionEnabled} onClick={corpus.onToggle}>
            {corpus.toggleLabel}
          </button>
          <button
            type="button"
            aria-label={corpus.backfillAriaLabel}
            disabled={corpus.backfillBusy}
            onClick={corpus.onBackfill}
          >
            {corpus.backfillLabel}
          </button>
        </div>
      </div>

      {/* 基础偏好区允许切换界面语言和文件系统沙箱权限。 */}
      <label>
        Language
        <select value={preferences.locale} onChange={(event) => preferences.onLocaleChange(event.target.value)}>
          <option value="zh-CN">简体中文</option>
          <option value="ja">日本語</option>
        </select>
      </label>
      <label>
        Sandbox
        <select value={preferences.sandboxMode} onChange={(event) => preferences.onSandboxModeChange(event.target.value)}>
          <option value="read-only">{preferences.readOnlyLabel}</option>
          <option value="workspace-write">{preferences.writeLabel}</option>
        </select>
      </label>

      {/* 工作区设置管理 Codex 的工程目录和每个目录的写入权限。 */}
      <section className="workspace-settings-card" aria-labelledby="workspace-settings-title">
        <header>
          <div>
            <span id="workspace-settings-title">{workspaces.title}</span>
            <small>{workspaces.summary}</small>
          </div>
          <button type="button" aria-label={workspaces.addLabel} onClick={workspaces.onAdd}>
            <Add24Regular />{workspaces.addLabel}
          </button>
        </header>
        <div className="workspace-settings-list">
          {workspaces.items.map((item) => (
            <article className="workspace-settings-item" key={item.id}>
              <div>
                <strong title={item.path}>{item.name}</strong>
                <small title={item.path}>{item.path}</small>
              </div>
              <div className="workspace-settings-actions">
                <button
                  type="button"
                  className={item.readOnly ? "read-only" : "workspace-write"}
                  data-sel-tooltip={item.permissionLabel}
                  data-sel-tooltip-mode="always"
                  aria-label={item.permissionLabel}
                  aria-pressed={item.readOnly}
                  onClick={item.onTogglePermission}
                >
                  {item.readOnly ? <ShieldLock16Filled /> : <ShieldLock16Regular />}
                </button>
                <button
                  type="button"
                  className={item.primary ? "primary-root" : ""}
                  data-sel-tooltip={item.primaryLabel}
                  data-sel-tooltip-mode="always"
                  aria-label={item.primaryLabel}
                  disabled={item.primary}
                  onClick={item.onMakePrimary}
                >
                  {item.primary ? <Star16Filled /> : <Star16Regular />}
                </button>
                <button
                  type="button"
                  data-sel-tooltip={item.removeLabel}
                  data-sel-tooltip-mode="always"
                  aria-label={item.removeLabel}
                  disabled={item.removeDisabled}
                  onClick={item.onRemove}
                >
                  <Delete16Regular />
                </button>
              </div>
            </article>
          ))}
        </div>
        {workspaces.error && <em role="alert">{workspaces.error}</em>}
      </section>

      {/* 诊断区提供临时文件、可信命令和业务日志操作。 */}
      <div className="temp-card">
        <span>{diagnostics.tempTitle}</span>
        <strong>{diagnostics.tempSummary}</strong>
        <div>
          <button onClick={diagnostics.onOpenTemp}><FolderOpen24Regular />{diagnostics.openTempLabel}</button>
          <button className="danger" onClick={diagnostics.onClearTemp}><Delete24Regular />{diagnostics.clearTempLabel}</button>
        </div>
      </div>
      <div className="temp-card trust-card">
        <span>{diagnostics.trustedTitle}</span>
        <strong>{diagnostics.trustedCount}</strong>
        <small>{diagnostics.trustedHint}</small>
        <div>
          <button className="danger" disabled={diagnostics.trustedCount === 0} onClick={diagnostics.onClearTrusted}>
            <Delete24Regular />{diagnostics.clearTrustedLabel}
          </button>
        </div>
      </div>
      <div className="temp-card audit-card">
        <span>{diagnostics.auditTitle}</span>
        <strong>{diagnostics.auditSummary}</strong>
        {diagnostics.auditReasons.map((reason) => <em key={reason.code}>{reason.message}</em>)}
        <div>
          <button onClick={diagnostics.onOpenAudit}><FolderOpen24Regular />{diagnostics.openAuditLabel}</button>
        </div>
      </div>

      {/* 规则管理 Feature 保持自己的状态所有权。 */}
      <RuleManagementFeature locale={viewModel.panel.locale} />
    </SettingsFloatingPanel>
  );
}
