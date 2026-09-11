import type {
  AuditLogInfoOutDto,
  CodexHarnessStatusOutDto,
  CodexModelCatalogOutDto,
  CollaborationStateOutDto,
  EvolutionStateOutDto,
  LocaleValue,
} from "../../../../contracts/system/desktop/index";
import { createTestConsoleViewModel } from "../model/createTestConsoleViewModel";
import { TestConsoleFloatingPanel } from "./TestConsoleFloatingPanel";
import { TestConsoleView } from "./TestConsoleView";

export type TestConsoleFeatureProps = {
  locale: LocaleValue;
  open: boolean;
  onOpenChange(open: boolean): void;
  runtime: CodexHarnessStatusOutDto["runtime"];
  modelCatalog: CodexModelCatalogOutDto;
  modelCatalogLoaded: boolean;
  modelCatalogLoading: boolean;
  modelCatalogError: string;
  audit: AuditLogInfoOutDto | null;
  collaboration: CollaborationStateOutDto | null;
  evolution: EvolutionStateOutDto | null;
};

/** 测试台 Feature 负责把实时状态转换成只读证据，并装入左侧活动栏浮动窗口。 */
export function TestConsoleFeature(props: TestConsoleFeatureProps) {
  const viewModel = createTestConsoleViewModel(props);
  return <TestConsoleFloatingPanel locale={props.locale} open={props.open} onOpenChange={props.onOpenChange}>
    <TestConsoleView viewModel={viewModel} />
  </TestConsoleFloatingPanel>;
}
