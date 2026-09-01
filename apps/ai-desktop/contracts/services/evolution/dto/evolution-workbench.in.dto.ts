import type { EvolutionWorkbenchPreferenceOutDto } from "./evolution-workbench.out.dto.js";
import type { EvolutionWorkbenchViewValue } from "../value/evolution-workbench.value.js";

export interface QueryEvolutionWorkbenchInDto {
  view: EvolutionWorkbenchViewValue;
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  sortField?: "updatedAt" | "createdAt" | "title" | "status";
  sortDirection?: "asc" | "desc";
}

export type SaveEvolutionWorkbenchPreferenceInDto = Omit<EvolutionWorkbenchPreferenceOutDto, "updatedAt">;
