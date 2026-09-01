/**
 * Workflow 生命周期控制输入协议。
 * 生产者：Renderer 自动化控制面；消费者：Workflow 编排服务。
 * 数据方向：Renderer -> preload -> IPC -> Workflow。
 * 本文件只表达控制动作，不携带人物决定或共享状态。
 */
export type PersonaWorkflowActionInDto = "start" | "pause" | "resume" | "stop" | "handover";
