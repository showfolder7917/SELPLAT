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
        const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
        if (request.method === "GET" && requestUrl.pathname === "/host-startup-evidence/context") {
          if (requestUrl.searchParams.get("token") !== token) {
            response.writeHead(401).end();
            return;
          }
          const current = currentTopicProposal(state.state());
          if (!current) {
            response.writeHead(409, { "content-type": "text/plain; charset=utf-8" }).end("当前没有可接收 Host 启动证据的专题提案。 ");
            return;
          }
          response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(current));
          return;
        }
        if (request.method !== "POST" || requestUrl.pathname !== "/host-startup-evidence") {
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
            const current = currentTopicProposal(state.state());
            const topicId = requiredField(fields, "topicId");
            const proposalId = requiredField(fields, "proposalId");
            if (!current || current.topicId !== topicId || current.proposalId !== proposalId) throw new Error("Host 启动期间当前专题或提案已经变化，已拒绝写入。 ");
            state.recordHostStartupEvidence({
              topicId,
              proposalId,
              launchId: requiredField(fields, "launchId"),
              handler: requiredField(fields, "handler"),
              startedAt: requiredField(fields, "startedAt"),
              commandLaunchId: requiredField(fields, "commandLaunchId"),
              commandState: requiredCommandState(fields),
              exitCode: optionalIntegerField(fields, "exitCode"),
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

function currentTopicProposal(current: EvolutionStateOutDto): { topicId: string; proposalId: string } | null {
  const topicId = current.activeTopicId;
  const proposal = topicId ? current.proposals.find((item) => item.topicId === topicId && item.version === current.topics.find((topic) => topic.topicId === topicId)?.currentProposalVersion) : null;
  return topicId && proposal ? { topicId, proposalId: proposal.proposalId } : null;
}

function requiredField(fields: URLSearchParams, key: string): string {
  const value = fields.get(key)?.trim() || "";
  if (!value) throw new Error(`Host 启动证据缺少 ${key}。`);
  return value;
}

function requiredCommandState(fields: URLSearchParams): "running" | "exited" {
  const state = requiredField(fields, "commandState");
  if (state !== "running" && state !== "exited") throw new Error("Host 启动进程状态无效。 ");
  return state;
}

function optionalIntegerField(fields: URLSearchParams, key: string): number | null {
  const value = fields.get(key)?.trim() || "";
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Host 启动证据中的 ${key} 必须为整数。`);
  return parsed;
}
