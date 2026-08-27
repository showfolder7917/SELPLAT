/**
 * 工作区协议，描述用户已登记的工程根、权限和目录浏览结果。
 *
 * 生产者：Renderer 工作区操作和主进程 WorkspaceStore。
 * 消费者：preload 白名单、文件浏览器、Codex 与协作服务。
 * 数据方向：renderer -> preload -> main，状态结果反向返回。
 * 本文件不访问真实文件系统，路径存在性和越界检查由主进程负责。
 */
import type { WorkspacePermission } from "../foundation/base.js";

export interface WorkspaceRoot {
  id: string;
  name: string;
  path: string;
  permission: WorkspacePermission;
}

export interface WorkspaceState {
  primaryId: string;
  roots: WorkspaceRoot[];
}

export interface WorkspaceEntry {
  name: string;
  kind: "directory" | "file";
}
