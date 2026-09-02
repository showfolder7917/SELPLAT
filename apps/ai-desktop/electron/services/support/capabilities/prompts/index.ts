// 公开提示词门面及其类型契约；调用方只按逻辑 ID 渲染，不读取或猜测 Markdown 物理路径。
export {
  PromptLibraryFacade,
  type PromptDescriptor,
  type PromptLibraryPort,
  type PromptVariables,
} from "./prompt-library.facade.js";
