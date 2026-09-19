import path from "node:path";
import { build } from "esbuild";
import { openMonitorAcceptanceRepository } from "./monitor-acceptance-card.repository.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../../..");
const requestedDatabasePath = process.argv.find((item) => item.startsWith("--database-path="))?.slice("--database-path=".length).trim();
const databasePath = requestedDatabasePath ? path.resolve(requestedDatabasePath) : path.join(projectRoot, "apps/ai-desktop/db/workflow-control.sqlite3");
const sourcePath = path.join(projectRoot, "apps/ai-desktop/electron/services/evolution/internal/evolution-state.store.ts");

function requiredOption(name) {
  const marker = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(marker))?.slice(marker.length).trim();
  if (!value) throw new Error(`缺少 ${marker}<值>`);
  return value;
}

const title = requiredOption("title");
const resultSummary = requiredOption("summary");
const evidence = requiredOption("evidence").split("|").map((item) => item.trim()).filter(Boolean);
const acceptanceCriteria = requiredOption("criteria").split("|").map((item) => item.trim()).filter(Boolean);
const sourceRequestId = process.argv.find((item) => item.startsWith("--source-request-id="))?.split("=").slice(1).join("=").trim() || null;
const retiredReason = requiredOption("retired-reason");

const bundled = await build({ entryPoints: [sourcePath], bundle: true, format: "esm", platform: "node", target: "es2022", write: false });
const { EvolutionStateStore } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const persistence = openMonitorAcceptanceRepository(databasePath, { retiredReason, resultSummary, evidence });

try {
  const state = new EvolutionStateStore(persistence.repository).createMonitorAcceptanceCard({
    title,
    goal: `对正式版本“${title}”建立独立页面验收记录。`,
    evidence,
    acceptanceCriteria,
    resultSummary,
    sourceRequestId,
    retiredReason,
  });
  process.stdout.write(`${JSON.stringify({ topicId: state.oneShotRun.topicId, proposalId: state.oneShotRun.proposalId, status: state.oneShotRun.status, title }, null, 2)}\n`);
} finally {
  persistence.close();
}
