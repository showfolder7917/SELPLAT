// 从韩立公开契约读取研讨及轮次快照，领域层不依赖人物内部服务。
import type {
  HanliDeliberationRoundOutDto,
  HanliEvolutionDeliberationOutDto,
} from "../../../../contracts/services/personas/hanli/index.js";

/** 用户对南宫婉范围说明的领域决定。 */
export interface DeliberationConfirmationDecision {
  /** confirm 表示接受当前范围，revise 表示需要继续调查。 */
  kind: "confirm" | "revise";
  /** 原始用户回复；应用服务必须完整保存而不是改写为固定文案。 */
  customerReply: string;
}

/**
 * 韩立与南宫婉内部研讨聚合根。
 *
 * 该实体只解释研讨当前阶段以及用户回复应触发的领域动作；
 * 模型调用、消息发布和 Evolution 持久化继续由应用服务负责。
 */
export class HanliNangongDeliberationAggregate {
  /** 构造时冻结的完整研讨事实，保证一次推进使用同一轮状态。 */
  readonly #deliberation: HanliEvolutionDeliberationOutDto;

  /** 使用一份持久研讨快照创建聚合根，不产生模型调用或写操作。 */
  constructor(deliberation: HanliEvolutionDeliberationOutDto) {
    // 研讨必须至少包含一轮韩立问题，否则无法形成可恢复对话。
    if (deliberation.rounds.length === 0) {
      // 明确拒绝损坏研讨数据。
      throw new Error("内部研讨缺少韩立问题轮次，不能继续推进。");
    }
    // 深拷贝快照，防止异步模型调用期间原数组被改变。
    this.#deliberation = structuredClone(deliberation);
  }

  /** 返回研讨稳定标识。 */
  deliberationId(): string {
    // 标识来自持久事实，不根据专题或时间推断。
    return this.#deliberation.deliberationId;
  }

  /** 返回当前最后一轮完整副本。 */
  currentRound(): HanliDeliberationRoundOutDto {
    // 构造器已经保证至少存在一轮。
    const round = this.#deliberation.rounds.at(-1)!;
    // 返回深拷贝，应用服务不能绕过 Evolution Store 修改轮次。
    return structuredClone(round);
  }

  /** 判断当前研讨是否正在等待南宫婉回答。 */
  needsNangongAnswer(): boolean {
    // 当前轮 answer 为空代表问题已经形成但尚未回答。
    return this.currentRound().answer === null;
  }

  /** 判断当前研讨是否已经形成候选并等待建立专题。 */
  isReadyToEstablish(): boolean {
    // 状态和候选必须同时存在，不能只凭一段模型文本进入提案阶段。
    return this.#deliberation.status === "ready-to-establish" && this.#deliberation.candidate !== null;
  }

  /** 判断当前范围说明是否正在等待用户确认。 */
  awaitsCustomerConfirmation(): boolean {
    // 读取当前轮确认事实。
    const confirmation = this.currentRound().confirmation;
    // 没有展示范围说明时不能解释用户回复。
    if (!confirmation) {
      // 返回 false 让应用服务继续形成说明。
      return false;
    }
    // 已有回复代表确认门禁已经完成，重复输入不得再次推进。
    return confirmation.reply === null;
  }

  /** 根据当前确认门禁解释用户回复。 */
  decideConfirmation(reply: string): DeliberationConfirmationDecision {
    // 去除输入法附带空白，但保留用户正文内容。
    const normalizedReply = reply.trim();
    // 空回复无法表达接受或纠正。
    if (!normalizedReply) {
      // 明确要求用户给出真实回复。
      throw new Error("请确认当前范围，或直接说明需要纠正的内容。");
    }
    // 只有正在等待确认的轮次允许处理本次回复。
    if (!this.awaitsCustomerConfirmation()) {
      // 防止历史输入推进新的研讨链。
      throw new Error("当前没有等待确认的内部研讨范围。");
    }
    // 独立数字 1 是唯一的直接确认命令。
    if (normalizedReply === "1") {
      // 返回结构化确认动作，应用服务不再二次解释文案。
      return { kind: "confirm", customerReply: normalizedReply };
    }
    // 其他完整回复都作为客户纠正进入下一轮调查。
    return { kind: "revise", customerReply: normalizedReply };
  }
}
