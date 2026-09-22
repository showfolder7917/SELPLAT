/**
 * 验收证据账本门面。
 *
 * 窗口适配器只负责产生截图；条件校验只通过本门面查询证据归属，
 * 不再共同维护多组可变集合。
 */
export class HanliAcceptanceEvidenceFacade {
  #latestScreenshotId = "";
  readonly #evidenceIds: string[] = [];
  readonly #postInputEvidenceIds = new Set<string>();
  readonly #criterionEvidenceIds = new Map<string, Set<string>>();
  readonly #taskCollaborationEvidenceIds = new Set<string>();

  get latestScreenshotId(): string {
    return this.#latestScreenshotId;
  }

  get evidenceIds(): string[] {
    return [...this.#evidenceIds];
  }

  get hasArchivedScreenshot(): boolean {
    return Boolean(this.#latestScreenshotId && this.#evidenceIds.includes(this.#latestScreenshotId));
  }

  clearLatestScreenshot(): void {
    this.#latestScreenshotId = "";
  }

  archiveScreenshot(screenshotId: string, inputCount: number, taskCollaborationVisible: boolean): void {
    this.#latestScreenshotId = screenshotId;
    this.#evidenceIds.push(screenshotId);
    if (inputCount > 0) this.#postInputEvidenceIds.add(screenshotId);
    if (taskCollaborationVisible) this.#taskCollaborationEvidenceIds.add(screenshotId);
  }

  bindLatestToCriteria(criterionIds: string[]): void {
    if (!this.#latestScreenshotId) return;
    for (const criterionId of criterionIds) {
      const current = this.#criterionEvidenceIds.get(criterionId) || new Set<string>();
      current.add(this.#latestScreenshotId);
      this.#criterionEvidenceIds.set(criterionId, current);
    }
  }

  isCurrentObservation(observationId: unknown): boolean {
    return Boolean(this.#latestScreenshotId && observationId === this.#latestScreenshotId);
  }

  hasCriterionEvidence(criterionId: string, evidenceId: unknown, requirePostInput: boolean): boolean {
    const id = String(evidenceId);
    const archived = requirePostInput ? this.#postInputEvidenceIds.has(id) : this.#evidenceIds.includes(id);
    return archived && this.#criterionEvidenceIds.get(criterionId)?.has(id) === true;
  }

  isTaskCollaborationEvidence(evidenceId: unknown): boolean {
    return this.#taskCollaborationEvidenceIds.has(String(evidenceId));
  }
}
