import { readFileSync } from "node:fs";

type JsonRecord = Record<string, unknown>;
const object = (value: unknown): JsonRecord => value && typeof value === "object" ? value as JsonRecord : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const plain = (value: unknown): string => typeof value === "string" ? value.replace(/\u001b\[[0-9;]*m/g, "") : "";

/** 提取报告事实而非推断根因；预算不足明确指出省略内容，完整报告始终可继续读取。 */
export function summarizeValidationFailure(reportPath: string, logPath: string, fallback: string): string {
  const entries: string[] = [];
  let reportAvailable = false;
  try {
    const report = object(JSON.parse(readFileSync(reportPath, "utf8")));
    reportAvailable = true;
    const errorText = (value: unknown) => {
      const error = object(value);
      return plain(error.message) || plain(error.stack) || plain(error.value);
    };
    for (const error of list(report.errors)) entries.push(`测试运行错误：${errorText(error)}`);
    const visit = (value: unknown, parents: string[]) => {
      const suite = object(value);
      const titles = [...parents, plain(suite.title)].filter(Boolean);
      for (const rawSpec of list(suite.specs)) {
        const spec = object(rawSpec);
        for (const rawTest of list(spec.tests)) {
          const test = object(rawTest);
          for (const rawResult of list(test.results)) {
            const result = object(rawResult);
            if (!["failed", "timedOut", "interrupted"].includes(String(result.status))) continue;
            const errors = list(result.errors).map(errorText).filter(Boolean);
            if (!errors.length && result.error) errors.push(errorText(result.error));
            const attachments = list(result.attachments).map(value => plain(object(value).path)).filter(Boolean);
            entries.push([
              `失败：${[...titles, plain(spec.title)].join(" / ")}`,
              `位置：${plain(spec.file) || plain(suite.file)}:${spec.line ?? "未知"}:${spec.column ?? "未知"}`,
              `状态：${result.status}；工具内部重试序号：${result.retry ?? 0}`,
              ...errors, ...attachments.map(value => `证据：${value}`),
            ].join("\n"));
          }
        }
      }
      for (const child of list(suite.suites)) visit(child, titles);
    };
    for (const suite of list(report.suites)) visit(suite, []);
  } catch { /* 报告缺失或损坏也是真实失败，不得当作测试通过。 */ }
  if (!entries.length) {
    // 编译或测试启动前失败可能没有 JSON；保留匹配到的错误及邻近上下文，不能只取末尾。
    let log = fallback;
    try { log = readFileSync(logPath, "utf8"); } catch { /* 日志不可读时保留调用方错误。 */ }
    const lines = plain(log).split("\n");
    const selected = new Set<number>();
    lines.forEach((line, index) => {
      if (/error|failed|exception|expected|received|错误|失败/i.test(line)) {
        for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 5); i++) selected.add(i);
      }
    });
    entries.push(`结构化失败报告${reportAvailable ? "未包含具体失败项" : "缺失或不可读"}；必须先读取完整日志定位，不能据此猜测修改。\n${[...selected].sort((a, b) => a - b).slice(0, 100).map(i => `${i + 1}: ${lines[i]}`).join("\n") || fallback}`);
  }
  let remaining = 12_000;
  let omitted = 0;
  const visible = entries.map((entry, index) => {
    const allowed = Math.max(0, Math.min(4_000, remaining));
    remaining -= Math.min(entry.length, allowed);
    if (!allowed) { omitted++; return ""; }
    return `失败记录 ${index + 1}\n${entry.slice(0, allowed)}` + (entry.length > allowed ? "\n[本项详情未全部展开，请读取完整报告]" : "");
  }).filter(Boolean);
  return [`共 ${entries.length} 条失败记录。`, ...visible, ...(omitted ? [`另有 ${omitted} 条记录未展开，须到完整报告逐项核对，不能当作没有其他失败。`] : []), `完整报告：${reportPath}`, `完整日志：${logPath}`, "以上为工具事实，不代表根因结论；信息不足先补读证据。"].join("\n\n");
}
