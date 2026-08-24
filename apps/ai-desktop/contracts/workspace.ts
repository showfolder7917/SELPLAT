import type { WorkspacePermission } from "./base.js";

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
