import type { CollaborationWorkerPhaseValue } from "./collaboration-member.value.js";

export type CollaborationFlowEventTypeValue =
  | "task.submitted" | "task.legacy_imported" | "executor.assigned" | "executor.reassigned"
  | "technical_analysis.ready" | "execution.started" | `worker.phase.${Exclude<CollaborationWorkerPhaseValue, null>}`
  | "executor.self_test_started" | "executor.self_test_passed" | "executor.self_test_failed"
  | "executor.self_repair_started" | "executor.self_repair_completed" | "executor.self_repair_failed"
  | "task.code_verified" | "task.blocked" | "task.cancelled" | "task.interrupted" | "task.recovery_requested"
  | "execution.repair_queued" | "execution.repair_started" | "execution.repair_investigated" | "execution.repair_completed" | "execution.repair_waiting"
  | "integration.local_changes_transferred" | "integration.batch_frozen" | "integration.local_change_ownership_blocked"
  | "integration.merge_conflict" | "integration.candidate_preparation_failed" | "integration.infrastructure_failed" | "integration.conflict_correction_requested"
  | "evolution.task_collected" | "unified_test.started" | "unified_test.passed" | "unified_test.failed" | "unified_test.retry_requested"
  | "unified_test.repair_started" | "unified_test.repair_investigated" | "unified_test.repair_completed" | "unified_test.repair_failed"
  | "release.restart_healthy";
