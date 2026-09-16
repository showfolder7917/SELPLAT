import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CollaborationMemberOutDto } from "../../../../../contracts/services/workflow/index.js";

/** Renderer 导航偏好只保留最后一次成功保存的人物标识，不承载协作成员或任务事实。 */
export class CollaborationNavigationPreferenceStore {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = path.resolve(filePath);
  }

  /** 用当前权威成员清单恢复偏好；失效记录只回退显示目标，不写回协作状态。 */
  restore(members: CollaborationMemberOutDto[]): string | null {
    const fallback = members.find((member) => member.kind === "conversation-owner")?.memberId || members[0]?.memberId || null;
    const memberId = this.#readMemberId();
    return memberId && members.some((member) => member.memberId === memberId) ? memberId : fallback;
  }

  /** 写入最后一次已由 Renderer 提交的人物标识；成员有效性始终以本次权威清单校验。 */
  save(memberId: string, members: CollaborationMemberOutDto[]): void {
    if (!members.some((member) => member.memberId === memberId)) throw new Error("人物已不在当前协作成员列表中，无法保存查看位置。");
    mkdirSync(path.dirname(this.#filePath), { recursive: true });
    const temporary = `${this.#filePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify({ memberId }, null, 2)}\n`, "utf8");
    renameSync(temporary, this.#filePath);
  }

  #readMemberId(): string | null {
    if (!existsSync(this.#filePath)) return null;
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as { memberId?: unknown };
      return typeof value.memberId === "string" && value.memberId.trim() ? value.memberId : null;
    } catch {
      return null;
    }
  }
}
