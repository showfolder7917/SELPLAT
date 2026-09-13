/**
 * 工作区协议，描述用户已登记的工程根与权限。
 *
 * 生产者：Renderer 工作区操作和主进程 WorkspaceStore。
 * 消费者：preload 白名单、文件浏览器、Codex 与协作服务。
 * 数据方向：renderer -> preload -> main，状态结果反向返回。
 * 本文件不访问真实文件系统，路径存在性和越界检查由主进程负责。
 */
import type { WorkspacePermissionValue } from "../../../../../foundation/index.js";

export interface WorkspaceRootOutDto {
  id: string;
  name: string;
  path: string;
  permission: WorkspacePermissionValue;
}

export interface WorkspaceStateOutDto {
  primaryId: string;
  roots: WorkspaceRootOutDto[];
}

/** 已登记工作区内一个可安全展示的直接子项；路径始终相对工作区根。 */
export interface WorkspaceDirectoryEntryOutDto {
  name: string;
  relativePath: string;
  kind: "directory" | "file";
}

/** 单层目录读取结果；不返回磁盘绝对路径或未登记目录内容。 */
export interface WorkspaceDirectoryOutDto {
  workspaceId: string;
  relativePath: string;
  entries: WorkspaceDirectoryEntryOutDto[];
}

/** 应用内只读文本预览；内容已由主进程完成大小、编码和根边界校验。 */
export interface WorkspaceFilePreviewOutDto {
  workspaceId: string;
  relativePath: string;
  content: string;
}
