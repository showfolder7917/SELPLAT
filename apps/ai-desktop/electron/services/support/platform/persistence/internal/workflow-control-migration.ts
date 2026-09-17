import type { DatabasePort } from "../database.facade.js";

// 只迁移控制面与客户可见审计事实；人物记忆、会话正文、语料和检查点继续留在 AI Memory 后台库。
const CONTROL_TABLES = [
  "AiDesktopRuntimeSession",
  "AiDesktopMemberRuntime",
  "AiDesktopEvent",
  "AiDesktopWorkflowRun",
  "AiDesktopTaskExecution",
  "AiDesktopApprovalRecord",
  "AiDesktopApprovalGovernance",
  "AiDesktopEvolutionDeliberation",
  "AiDesktopEvolutionSourceSnapshot",
  "AiDesktopEvolutionArchiveRecord",
  "AiDesktopEvolutionRound",
  "AiDesktopEvolutionRoundTask",
  "AiDesktopEvolutionWorkbenchPreference",
  "AiDesktopEvolutionState",
  "AiDesktopPersonaSession",
  "AiDesktopTaskTimelineTopic",
  "AiDesktopTaskTimelineEvent",
  "AiDesktopTaskTimelineStream",
] as const;

/** 首次拆分时在 AI Memory Worker 内完成受控复制；成功后控制库由主进程独占。 */
export function migrateWorkflowControlData(source: DatabasePort, workflowDatabasePath: string): void {
  source.withConnection((connection) => {
    connection.prepare("ATTACH DATABASE $databasePath AS workflow_control").run({ $databasePath: workflowDatabasePath });
    try {
      connection.exec("PRAGMA foreign_keys = OFF");
      connection.exec("BEGIN IMMEDIATE");
      try {
        for (const table of CONTROL_TABLES) {
          const columns = connection.prepare(`PRAGMA main.table_info(${quotedIdentifier(table)})`).all() as Array<{ name: string }>;
          if (!columns.length) continue;
          const targetExists = connection.prepare(
            "SELECT 1 FROM workflow_control.sqlite_master WHERE type='table' AND name=$table",
          ).get({ $table: table });
          if (!targetExists) throw new Error(`工作流控制库缺少目标表：${table}`);
          const columnList = columns.map((column) => quotedIdentifier(column.name)).join(", ");
          connection.exec(`INSERT OR IGNORE INTO workflow_control.${quotedIdentifier(table)} (${columnList}) SELECT ${columnList} FROM main.${quotedIdentifier(table)}`);
        }
        connection.exec("COMMIT");
      } catch (error) {
        try { connection.exec("ROLLBACK"); } catch { /* 原迁移错误优先。 */ }
        throw error;
      } finally {
        connection.exec("PRAGMA foreign_keys = ON");
      }
    } finally {
      connection.exec("DETACH DATABASE workflow_control");
    }
  });
}

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
