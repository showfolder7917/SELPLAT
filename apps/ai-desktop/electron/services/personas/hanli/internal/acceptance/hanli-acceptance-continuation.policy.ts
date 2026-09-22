export type HanliAcceptanceContinuation =
  | { kind: "retry-observation" }
  | { kind: "finish-only" }
  | { kind: "correction"; rejection: string };

export function selectHanliAcceptanceContinuation(input: {
  completed: boolean;
  hasArchivedScreenshot: boolean;
  finishAttempted: boolean;
  finishRejection: string;
  finalizationAttempted: boolean;
  correctionAttempted: boolean;
  observationRecoveryAttempted: boolean;
}): HanliAcceptanceContinuation | null {
  if (input.completed) return null;
  if (!input.hasArchivedScreenshot) {
    return input.observationRecoveryAttempted ? null : { kind: "retry-observation" };
  }
  if (!input.finishAttempted) return input.finalizationAttempted ? null : { kind: "finish-only" };
  if (!input.finishRejection || input.correctionAttempted) return null;
  return { kind: "correction", rejection: input.finishRejection };
}
