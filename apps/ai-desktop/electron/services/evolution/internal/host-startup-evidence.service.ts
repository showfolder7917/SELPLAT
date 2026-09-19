/**
 * 根目录 Host 启动器的受控证据接收端。
 * 生产者：启动SELPLAT.command；消费者：EvolutionStateStore 与当前专题只读投影。
 * 数据方向：本机启动器 -> 受控本地 HTTP 接收端 -> Evolution 状态快照。
 * 本文件不访问 SQLite，也不决定专题完成状态。
 */
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";

import type { EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { HostStartupEvidenceInput } from "./evolution-state.store.js";

/** 应用运行时持有的受控服务；启动器只持有短期端点说明，不直接触及持久化。 */
export interface HostStartupEvidenceService {
  start(): void;
  dispose(): Promise<void>;
}

export function createHostStartupEvidenceService(
  state: { state(): EvolutionStateOutDto; recordHostStartupEvidence(input: HostStartupEvidenceInput): EvolutionStateOutDto },
  endpointFile: string,
): HostStartupEvidenceService {
  let server: Server | null = null;
  const token = randomBytes(32).toString("hex");

  return {
    start() {
      if (server) return;
      server = createServer((request, response) => {
        if (request.method !== "POST" || request.url !== "/host-startup-evidence") {
          response.writeHead(404).end();
          return;
        }
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk: string) => { body += chunk; });
        request.on("end", () => {
          try {
            const fields = new URLSearchParams(body);
            if (fields.get("token") !== token) throw new Error("Host 启动证据凭据无效。 ");
            const current = state.state();
            const topicId = current.activeTopicId;
            const proposal = topicId ? current.proposals.find((item) => item.topicId === topicId && item.version === current.topics.find((topic) => topic.topicId === topicId)?.currentProposalVersion) : null;
            if (!topicId || !proposal) throw new Error("当前没有可接收 Host 启动证据的专题提案。 ");
            state.recordHostStartupEvidence({
              topicId,
              proposalId: proposal.proposalId,
              launchId: requiredField(fields, "launchId"),
              handler: requiredField(fields, "handler"),
              startedAt: requiredField(fields, "startedAt"),
              commandLaunchId: requiredField(fields, "commandLaunchId"),
              exitCode: Number(requiredField(fields, "exitCode")),
              healthLaunchId: requiredField(fields, "healthLaunchId"),
              healthSuccess: fields.get("healthSuccess") === "true",
              healthCheckedAt: requiredField(fields, "healthCheckedAt"),
              healthSummary: requiredField(fields, "healthSummary"),
              evidenceReferences: ["启动SELPLAT.command", "http://localhost:8080/api/platform/runtime/health"],
            });
            response.writeHead(204).end();
          } catch (error) {
            response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end(error instanceof Error ? error.message : "Host 启动证据写入失败。 ");
          }
        });
      });
      server.listen(0, "127.0.0.1", () => {
        const address = server?.address();
        if (!address || typeof address === "string") return;
        mkdirSync(path.dirname(endpointFile), { recursive: true, mode: 0o700 });
        writeFileSync(endpointFile, JSON.stringify({ version: 1, endpoint: `http://127.0.0.1:${address.port}/host-startup-evidence`, token }), { encoding: "utf8", mode: 0o600 });
        chmodSync(endpointFile, 0o600);
      });
    },
    async dispose() {
      const active = server;
      server = null;
      rmSync(endpointFile, { force: true });
      if (active) await new Promise<void>((resolve) => active.close(() => resolve()));
    },
  };
}

function requiredField(fields: URLSearchParams, key: string): string {
  const value = fields.get(key)?.trim() || "";
  if (!value) throw new Error(`Host 启动证据缺少 ${key}。`);
  return value;
}
