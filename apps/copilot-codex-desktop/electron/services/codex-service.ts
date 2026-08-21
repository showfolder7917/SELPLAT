import { Codex } from "@openai/codex-sdk";

import type { Locale, SandboxMode, SendMessageResponse } from "../../shared/contracts/desktop.js";

export class CodexService {
  readonly #codex = new Codex();
  readonly #workingDirectory: string;
  #thread: ReturnType<Codex["startThread"]> | undefined;
  #threadSandbox: SandboxMode | undefined;
  #activeController: AbortController | undefined;

  constructor(workingDirectory: string) {
    this.#workingDirectory = workingDirectory;
  }

  newChat(): void {
    this.cancel();
    this.#thread = undefined;
    this.#threadSandbox = undefined;
  }

  cancel(): boolean {
    if (!this.#activeController) return false;
    this.#activeController.abort(new Error("Cancelled by user."));
    this.#activeController = undefined;
    return true;
  }

  async send(message: string, locale: Locale, sandboxMode: SandboxMode): Promise<SendMessageResponse> {
    const normalizedMessage = message.trim();
    if (!normalizedMessage || normalizedMessage.length > 20_000) {
      throw new Error("Message must contain 1-20000 characters.");
    }

    this.cancel();
    this.#activeController = new AbortController();
    try {
      const result = await this.#getThread(sandboxMode).run(
        `${this.#responseLanguage(locale)}\n\n${normalizedMessage}`,
        { signal: this.#activeController.signal },
      );
      return { text: result.finalResponse, itemCount: result.items.length };
    } finally {
      this.#activeController = undefined;
    }
  }

  #getThread(sandboxMode: SandboxMode) {
    if (!this.#thread || this.#threadSandbox !== sandboxMode) {
      this.#thread = this.#codex.startThread({
        workingDirectory: this.#workingDirectory,
        sandboxMode,
        approvalPolicy: "never",
        networkAccessEnabled: false,
      });
      this.#threadSandbox = sandboxMode;
    }
    return this.#thread;
  }

  #responseLanguage(locale: Locale): string {
    return locale === "ja"
      ? "Reply in natural Japanese unless the user explicitly requests another language."
      : "除非用户明确要求其他语言，否则请使用自然、清晰的简体中文回答。";
  }
}
