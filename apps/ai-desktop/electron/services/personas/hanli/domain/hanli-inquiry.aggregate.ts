/**
 * 韩立只读排查聚合：维护原问题、逐轮证据、判断和可恢复阶段。
 * 不调用模型或数据库，不授权写入，也不把无法查证的结论升级为事实。
 */
import type { SendPersonaConversationMessageInDto, PersonaConversationActivityOutDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { NangongInquiryResultOutDto } from "../../../../../contracts/services/personas/nangong/index.js";
import type { ConversationRoundTopicDecisionInDto } from "../../../../../contracts/services/support/capabilities/event-center/index.js";

/** 每轮调查都必须围绕同一原始客户目标。 */
export interface InquiryGoal {
  customerQuestion: string;
  understoodGoal: string;
  verificationTarget: string;
  expectedAnswer: string;
  investigationQuestion: string;
}

/** 韩立独立判断是否已经能够回答，或是否还需要同范围补查。 */
export interface InquiryAssessment {
  action: "conclude" | "investigate" | "blocked";
  reason: string;
  nextQuestion: string;
  missingEvidence: string[];
}

/** 一轮中的调查和评估分别保存，解释失败不能丢掉调查依据。 */
export interface InquiryRound {
  question: string;
  findings?: NangongInquiryResultOutDto;
  assessment?: InquiryAssessment;
}

/** 持久恢复点只属于当前业务会话和请求。 */
export interface InquirySnapshot {
  version: 1;
  conversationId: string;
  requestId: string;
  request: SendPersonaConversationMessageInDto;
  selectedModel: string | null;
  goal: InquiryGoal;
  decision: ConversationRoundTopicDecisionInDto;
  phase: PersonaConversationActivityOutDto["phase"];
  status: "running" | "retryable" | "completed" | "blocked";
  summary: string;
  updatedAt: string;
  rounds: InquiryRound[];
  /** 无法继续查证时解释已有证据，但最终状态仍保留 blocked。 */
  limitation?: string;

}

const MAX_INVESTIGATION_ROUNDS = 3;

/** 将逐轮状态约束集中在一个领域对象，应用服务只执行其当前阶段。 */
export class HanliInquiryAggregate {
  constructor(readonly state: InquirySnapshot) {}

  get current(): InquiryRound {
    return this.state.rounds[this.state.rounds.length - 1]!;
  }

  transition(phase: InquirySnapshot["phase"], summary: string): void {
    this.state.phase = phase;
    this.state.status = "running";
    this.state.summary = summary;
    this.state.updatedAt = new Date().toISOString();
  }

  receive(findings: NangongInquiryResultOutDto): void {
    // 外部返回未经证据和目标校验不得进入恢复点。
    if (!findings || findings.answeredQuestion !== this.state.goal.customerQuestion
      || !["verified", "unknown"].includes(findings.status)
      || !findings.summary?.trim() || !Array.isArray(findings.evidence) || !Array.isArray(findings.unknowns)
      || findings.evidence.some((item) => !item.source?.trim() || !item.detail?.trim())
      || findings.unknowns.some((item) => typeof item !== "string")
      || (findings.status === "verified" && findings.evidence.length === 0)) {
      throw new Error("调查结果缺少对应原问题的有效证据结构。");
    }
    this.current.findings = findings;
    this.transition("assessing", "南宫婉已返回调查依据，韩立正在判断是否足以回答原问题。");
  }

  assess(assessment: InquiryAssessment): void {
    this.current.assessment = assessment;
    if (assessment.action === "investigate") {
      const nextQuestion = assessment.nextQuestion.trim();
      const repeatedQuestion = this.state.rounds.some((round) => round.question.trim() === nextQuestion);
      const previous = this.state.rounds.at(-2)?.findings;
      const current = this.current.findings!;
      const unchangedEvidence = previous && JSON.stringify(previous.evidence) === JSON.stringify(current.evidence)
        && JSON.stringify(previous.unknowns) === JSON.stringify(current.unknowns);
      if (!nextQuestion || repeatedQuestion || unchangedEvidence || this.state.rounds.length >= MAX_INVESTIGATION_ROUNDS) {
        if (this.state.rounds.length >= MAX_INVESTIGATION_ROUNDS) {
          this.state.limitation = "已完成三轮自动调查，证据仍不足；本轮停在已保存的依据，需补充新的核实条件后继续。";
        } else {
          this.state.limitation = "补查问题或证据重复，继续相同调查不会补齐缺口；需要新的依据或核实条件。";
        }
      } else {
        this.state.rounds.push({ question: nextQuestion });
        this.transition("queued", `第 ${this.state.rounds.length} 轮补查已准备，等待南宫婉接收。`);
        return;
      }
    }
    if (assessment.action === "blocked") this.state.limitation = assessment.reason;
    // 无证据结果不能因模型选择 conclude 而冒充核实成功。
    if (this.state.rounds.every((round) => !round.findings?.evidence.length)) {
      this.state.limitation ||= "当前没有可定位的证据，尚不能确定原因。";
    }
    this.transition("explaining", "韩立正在整理结论、依据、影响和下一步建议。");
  }

  fail(reason: string): void {
    this.state.status = "retryable";
    this.state.summary = `本次核实未完成：${reason}。已保存当前阶段，可以从这里重试。`;
    this.state.updatedAt = new Date().toISOString();
  }

  finish(): void {
    this.state.status = this.state.limitation ? "blocked" : "completed";
    this.state.phase = this.state.limitation ? "blocked" : "completed";
    this.state.summary = this.state.limitation || "排查结论已返回；本次未修改、构建或重启应用。";
    this.state.updatedAt = new Date().toISOString();
  }

  /** 解释阶段读取所有已保存依据，后轮结论不能抹掉前轮反例。 */
  findings(): NangongInquiryResultOutDto {
    const evidence: NangongInquiryResultOutDto["evidence"] = [];
    const unknowns = new Set<string>();
    const summaries: string[] = [];
    for (const round of this.state.rounds) {
      if (!round.findings) continue;
      summaries.push(round.findings.summary);
      for (const item of round.findings.evidence) {
        if (!evidence.some((prior) => prior.source === item.source && prior.detail === item.detail)) evidence.push(item);
      }
    }
    // 最新报告和韩立评估代表当前剩余缺口；历史未知项仍保留在逐轮档案中。
    for (const item of this.current.findings?.unknowns || []) unknowns.add(item);
    for (const item of this.current.assessment?.missingEvidence || []) unknowns.add(item);
    if (this.state.limitation) unknowns.add(this.state.limitation);
    return {
      status: unknowns.size || !evidence.length ? "unknown" : "verified",
      answeredQuestion: this.state.goal.customerQuestion,
      summary: summaries.join("\n\n"),
      evidence,
      unknowns: [...unknowns],
    };
  }
}
