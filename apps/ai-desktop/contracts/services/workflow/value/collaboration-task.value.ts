export type CollaborationMergeStrategyValue = "INDEPENDENT" | "ATOMIC_GROUP" | "DEPENDENCY_CHAIN";

export type CollaborationPlanStatusValue = "ready-for-execution";

export type CollaborationExecutionStatusValue = "assigned" | "analyzing" | "executing" | "code-verified" | "transferred" | "blocked" | "cancelled";

export type CollaborationResultOutcomeValue = "pending-integration" | "succeeded" | "incomplete" | "cancelled";

export type CollaborationAutomationSourceValue = "linghu-safeguard";

export type CollaborationTaskStateValue = "queued-executor" | "preparing-worktree" | "analyzing" | "executing" | "repairing-execution" | "returned-to-nangong" | "ready-for-integration" | "queued-integration" | "integrating" | "unified-testing" | "awaiting-restart" | "test-failed" | "integrated" | "blocked" | "recovering" | "cancelled";

export type CollaborationIntegrationFailureKindValue = "merge-conflict" | "local-change-ownership" | "candidate-branch-conflict" | "verification" | "infrastructure";
