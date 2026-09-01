/** 申请集成发布独占资源的输入。 */
export interface IntegrationReleaseInDto {
  releaseBatchId: string;
  version: string;
  generation: number;
  taskIds: string[];
  initiatorMemberId: string;
}
