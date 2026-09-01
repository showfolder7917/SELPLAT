/** 人物运行时对 Workflow 提供的最小生命周期能力。 */
export interface PersonaRuntimePort {
  /** 稳定成员编号，例如 nangong-wan、han-li 或 linghu-ancestor。 */
  readonly memberId: string;
  /** 启动人物自己的后台能力；重复调用必须安全。 */
  start(): void;
  /** 停止人物自己的后台能力；不得停止其他人物。 */
  stop(): void;
}
