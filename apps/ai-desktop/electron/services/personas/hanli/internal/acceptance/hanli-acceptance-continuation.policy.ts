export type HanliAcceptanceContinuation =
  | { kind: "finish-only" }
  | { kind: "correction"; rejection: string };

export function selectHanliAcceptanceContinuation(input: {
  completed: boolean;
  hasArchivedScreenshot: boolean;
  finishAttempted: boolean;
  finishRejection: string;
  correctionAttempted: boolean;
}): HanliAcceptanceContinuation | null {
  if (input.completed || !input.hasArchivedScreenshot) return null;
  if (!input.finishAttempted) return { kind: "finish-only" };
  if (!input.finishRejection || input.correctionAttempted) return null;
  return { kind: "correction", rejection: input.finishRejection };
}
