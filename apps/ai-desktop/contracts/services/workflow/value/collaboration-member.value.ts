export type DesktopOperatingModeValue = "single-conversation" | "collaboration";

export type CollaborationMemberKindValue = "conversation-owner" | "worker";

export type CollaborationMemberRoleValue = "conversation" | "executor" | null;

export type CollaborationMemberStateValue = "idle" | "conversation" | "assigned" | "working" | "retiring" | "recovering" | "draining" | "offline";

export type CollaborationWorkerPhaseValue = "analyzing" | "planning" | "implementing" | "verifying" | "finalizing" | "ready" | "blocked" | "failed" | null;
