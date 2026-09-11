import type {
  AuditLogInfoOutDto,
  CodexHarnessStatusOutDto,
  CodexModelCatalogOutDto,
  CollaborationStateOutDto,
  EvolutionStateOutDto,
  LocaleValue,
} from "../../../../contracts/system/desktop/index";

export type TestConsoleSource = {
  locale: LocaleValue;
  runtime: CodexHarnessStatusOutDto["runtime"];
  modelCatalog: CodexModelCatalogOutDto;
  modelCatalogLoaded: boolean;
  modelCatalogLoading: boolean;
  modelCatalogError: string;
  audit: AuditLogInfoOutDto | null;
  collaboration: CollaborationStateOutDto | null;
  evolution: EvolutionStateOutDto | null;
};

/** 隐藏记录中可能出现的本机绝对路径；测试台只保留足以验收的业务文字和相对文件名。 */
export function redactTestConsoleText(value: string): string {
  return value
    .replace(/\/(?:Users|home|var|private|tmp)\/[^\s，。；、"'`]+/gu, "[本机路径已隐藏]")
    .replace(/[A-Za-z]:\\[^\s，。；、"'`]+/gu, "[本机路径已隐藏]")
    .replace(/(token|authorization|password|secret)\s*[:=]\s*[^\s，。；、]+/giu, "$1=[敏感信息已隐藏]")
    .slice(0, 1_200);
}

/** 选择当前演化提案对应任务；没有演化上下文时回退到最后更新的普通任务。 */
function selectTask(source: TestConsoleSource) {
  const tasks = source.collaboration?.tasks || [];
  const proposalId = source.evolution?.oneShotRun?.proposalId || source.evolution?.proposals.at(-1)?.proposalId;
  const candidates = proposalId ? tasks.filter((task) => task.evolutionProposalId === proposalId) : tasks;
  return [...(candidates.length > 0 ? candidates : tasks)].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

/** 将内部状态名翻译成客户和验收人员都能理解的简短结论。 */
function statusLabel(status: string, locale: LocaleValue): string {
  const zh: Record<string, string> = {
    passed: "通过", failed: "未通过", pending: "等待中", running: "进行中", completed: "已完成",
    integrated: "已发布并重启", "pending-acceptance": "等待验收", blocked: "存在卡点", "not-run": "尚未执行",
  };
  const ja: Record<string, string> = {
    passed: "合格", failed: "不合格", pending: "待機中", running: "実行中", completed: "完了",
    integrated: "公開・再起動済み", "pending-acceptance": "受入確認待ち", blocked: "停止条件あり", "not-run": "未実行",
  };
  return (locale === "ja" ? ja : zh)[status] || status;
}

/** 把已有权威状态整理成只读测试台；本函数不执行测试，也不自行把任务判为通过。 */
export function createTestConsoleViewModel(source: TestConsoleSource) {
  const { locale } = source;
  const task = selectTask(source);
  const proposal = source.evolution?.proposals.find((item) => item.proposalId === task?.evolutionProposalId)
    || source.evolution?.proposals.at(-1)
    || null;
  const topic = source.evolution?.topics.find((item) => item.topicId === proposal?.topicId)
    || source.evolution?.topics.at(-1)
    || null;
  const run = source.evolution?.oneShotRun || null;
  const astraAppeared = source.modelCatalog.models.some((model) => `${model.id} ${model.displayName}`.toLocaleLowerCase().includes("astra"));
  const releaseEvent = [...(task?.flowEvents || [])].reverse().find((event) => event.type === "release.restart_healthy");
  const testEvent = [...(task?.flowEvents || [])].reverse().find((event) => event.type.startsWith("unified_test."));
  const acceptanceArchive = [...(source.evolution?.archiveRecords || [])].reverse().find((record) => record.category === "acceptance");
  const relevantArchive = (source.evolution?.archiveRecords || [])
    .filter((record) => ["execution", "test", "release", "acceptance", "recovery"].includes(record.category))
    .filter((record) => !proposal || !record.proposalId || record.proposalId === proposal.proposalId)
    .map((record) => ({ id: record.recordId, title: redactTestConsoleText(record.title), status: record.category, occurredAt: record.occurredAt }));
  const taskHistory = (task?.flowEvents || []).map((event) => ({
    id: event.eventId,
    title: redactTestConsoleText(event.summary),
    status: event.status,
    occurredAt: event.occurredAt,
  }));
  const history = [...taskHistory, ...relevantArchive]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 24);
  const changedFiles = [...new Set((task?.executionRecords || []).flatMap((record) => record.changedFiles || []))]
    .map(redactTestConsoleText)
    .slice(0, 40);
  const technicalEvidence = [
    ...(proposal?.evidence || []),
    ...(task?.flowEvents || []).flatMap((event) => event.details?.technicalEvidence || []),
    ...(source.audit?.latestTask?.reasons || []).map((reason) => `${reason.code}：${reason.message}`),
  ].map(redactTestConsoleText).filter(Boolean).slice(0, 40);
  const effectiveStatus = run?.status || task?.state || proposal?.status || "not-run";

  return {
    copy: locale === "ja" ? {
      title: "テスト台", open: "テスト台を開く", close: "テスト台を閉じる", readonly: "実行記録から生成された読み取り専用の受入証拠",
      change: "修正内容", checks: "検証結果", history: "実行履歴", technical: "技術証拠", empty: "表示できる記録はまだありません。",
      runtime: "実行バージョン", models: "モデル一覧", unifiedTest: "統合テスト", restart: "公開・再起動", acceptance: "受入確認", files: "変更ファイル",
    } : {
      title: "测试台", open: "打开测试台", close: "关闭测试台", readonly: "根据真实执行记录生成的只读验收证据",
      change: "修复内容", checks: "验证结果", history: "执行记录", technical: "技术证据", empty: "当前还没有可展示的记录。",
      runtime: "运行版本", models: "模型列表", unifiedTest: "统一测试", restart: "打包与重启", acceptance: "韩立验收", files: "修改文件",
    },
    summary: {
      title: redactTestConsoleText(topic?.title || proposal?.title || task?.snapshot.title || (locale === "ja" ? "現在の修正" : "当前修复")),
      status: statusLabel(effectiveStatus, locale),
      statusCode: effectiveStatus,
      change: redactTestConsoleText(task?.resultSummary?.changes || task?.resultSummary?.solvedProblem || proposal?.content || task?.snapshot.confirmedIntent || ""),
      remaining: redactTestConsoleText(task?.resultSummary?.remaining || run?.blockingReason || task?.blockingReason || ""),
      updatedAt: task?.updatedAt || source.evolution?.updatedAt || source.collaboration?.updatedAt || "",
    },
    checks: [
      {
        id: "runtime",
        label: locale === "ja" ? "実行バージョン" : "运行版本",
        status: source.runtime ? "passed" : "pending",
        detail: source.runtime ? `Codex ${source.runtime.version} · ${source.runtime.source === "bundled" ? (locale === "ja" ? "同梱" : "安装包内置") : (locale === "ja" ? "検証済み取得" : "校验下载")}` : (locale === "ja" ? "未取得" : "尚未读取"),
      },
      {
        id: "models",
        label: locale === "ja" ? "モデル一覧" : "模型列表",
        status: source.modelCatalogError ? "failed" : source.modelCatalogLoaded ? "passed" : "pending",
        detail: source.modelCatalogError
          ? redactTestConsoleText(source.modelCatalogError)
          : source.modelCatalogLoading ? (locale === "ja" ? "読み込み中…" : "正在读取…")
            : source.modelCatalogLoaded ? `${source.modelCatalog.models.length} ${locale === "ja" ? "件" : "个"} · Astra ${astraAppeared ? (locale === "ja" ? "あり" : "已出现") : (locale === "ja" ? "なし" : "未出现")}`
              : (locale === "ja" ? "未取得" : "尚未读取"),
      },
      {
        id: "unified-test",
        label: locale === "ja" ? "統合テスト" : "统一测试",
        status: task?.unifiedTest?.status || (testEvent?.status === "completed" ? "passed" : testEvent?.status || "pending"),
        detail: redactTestConsoleText(task?.unifiedTest?.failureReason || testEvent?.summary || (locale === "ja" ? "実行記録待ち" : "等待真实测试记录")),
      },
      {
        id: "restart",
        label: locale === "ja" ? "公開・再起動" : "打包与重启",
        status: releaseEvent ? "passed" : "pending",
        detail: redactTestConsoleText(releaseEvent?.summary || (locale === "ja" ? "正常性記録待ち" : "等待重启健康记录")),
      },
      {
        id: "acceptance",
        label: locale === "ja" ? "受入確認" : "韩立验收",
        status: proposal?.status === "completed" ? "passed" : acceptanceArchive ? (acceptanceArchive.eventType.includes("failed") ? "failed" : "running") : "pending",
        detail: redactTestConsoleText(acceptanceArchive?.title || (locale === "ja" ? "実操作の確認待ち" : "等待真实界面操作验收")),
      },
    ].map((check) => ({ ...check, statusLabel: statusLabel(check.status, locale) })),
    details: {
      acceptanceCriteria: (proposal?.acceptanceCriteria || task?.snapshot.acceptanceCriteria || []).map(redactTestConsoleText),
      changedFiles,
      technicalEvidence,
    },
    history,
  };
}

export type TestConsoleViewModel = ReturnType<typeof createTestConsoleViewModel>;
