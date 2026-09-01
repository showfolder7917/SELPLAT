/** 当前集成发布资源持有状态。 */
import type { IntegrationReleaseInDto } from "./integration-release.in.dto.js";

export interface IntegrationReleaseHolderOutDto extends IntegrationReleaseInDto {
  leaseId: string;
  processId: number;
  queuedAt: string;
  acquiredAt: string;
  heartbeatAt: string;
}
