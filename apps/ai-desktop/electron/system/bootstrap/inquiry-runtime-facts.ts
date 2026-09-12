import path from "node:path";
import type { WorkspaceStateOutDto } from "../../../contracts/services/support/platform/workspace/index.js";

/** 当前宿主自己提供的运行身份，不读取模型凭据或其他应用的数据。 */
export interface InquiryRuntimeIdentity {
  /** 该进程实际服务的工程根。 */
  projectRoot: string;
  /** 当前进程编号，用于区别源码副本与实际运行实例。 */
  processId: number;
  /** 启动时确定的应用包与页面构建位置。 */
  applicationRoot: string;
  rendererRoot: string;
  /** 已发布版本及启动时记录的提交；没有提交时保留未知。 */
  version: string;
  sourceSha: string | null;
  /** 只说明身份采集时间，不代表用户界面验收已通过。 */
  capturedAt: string;
}

/**
 * 只为原请求明确登记的同一工程提供宿主身份。
 * 这是运行证据而非读取权限：不把包目录添加到模型工作区，也不改变原确认范围。
 */
export function createInquiryRuntimeFacts(workspace: WorkspaceStateOutDto, runtime: InquiryRuntimeIdentity) {
  const includesCurrentProject = workspace.roots.some((root) => path.resolve(root.path) === path.resolve(runtime.projectRoot));
  if (!includesCurrentProject) return { status: "unavailable", reason: "当前实例不属于本次调查工作区，未提供其运行身份。" };
  return {
    status: "observed",
    source: "当前AI Desktop宿主进程",
    identity: { ...runtime },
    limitation: "仅证明当前运行身份；不代表页面操作、源码与包内容一致性或任务创建已经验证。",
  };
}
