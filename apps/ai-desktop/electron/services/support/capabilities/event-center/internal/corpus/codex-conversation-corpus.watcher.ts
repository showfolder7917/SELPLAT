import { existsSync, watch, type FSWatcher } from "node:fs";
import path from "node:path";

/** 监听外部 Codex 会话目录；只发出变化通知，不读取数据库或执行 SQL。 */
export class CodexConversationCorpusWatcher {
  readonly #roots: string[];
  readonly #onChanged: () => void;
  #watchers: FSWatcher[] = [];
  #debounceTimer: NodeJS.Timeout | null = null;
  #fallbackTimer: NodeJS.Timeout | null = null;

  constructor(roots: string[], onChanged: () => void) {
    this.#roots = roots.map((root) => path.resolve(root));
    this.#onChanged = onChanged;
  }

  start(): void {
    this.stop();
    for (const root of this.#roots) {
      if (!existsSync(root)) continue;
      try {
        this.#watchers.push(watch(root, { recursive: true }, (_event, fileName) => {
          if (!fileName || String(fileName).endsWith(".jsonl")) this.#schedule();
        }));
      } catch { /* 低频兜底扫描继续覆盖暂不支持递归监听的平台。 */ }
    }
    this.#fallbackTimer = setInterval(() => this.#onChanged(), 30_000);
  }

  stop(): void {
    for (const watcher of this.#watchers) watcher.close();
    this.#watchers = [];
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    if (this.#fallbackTimer) clearInterval(this.#fallbackTimer);
    this.#debounceTimer = null;
    this.#fallbackTimer = null;
  }

  #schedule(): void {
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = null;
      this.#onChanged();
    }, 800);
  }
}
