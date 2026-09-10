/**
 * Workflow 任务隔离工作区输出协议。
 *
 * 生产者：版本工作区管理器。
 * 消费者：任务执行、集成和故障恢复流程。
 * 数据方向：版本管理能力 -> Workflow 消费者。
 * 本文件只描述工作区事实，不授予文件系统写权限。
 */

/** 为单个任务创建的隔离 Git 工作区。 */
export interface CollaborationVersionWorkspaceOutDto {
  /** 工作区记录的唯一标识。 */
  workspaceId: string;
  /** 工作区的真实绝对根目录。 */
  rootPath: string;
  /** 工作区关联的 Git 分支名。 */
  branchName: string;
  /** 创建工作区时作为起点的提交 SHA。 */
  baseSha: string;
  /** 任务结果提交 SHA；尚未提交时为 null。 */
  resultSha: string | null;
  /** 工作区创建时间。 */
  createdAt: string;
  /** 工作区退出使用的时间；仍在使用时为 null。 */
  retiredAt: string | null;
}
