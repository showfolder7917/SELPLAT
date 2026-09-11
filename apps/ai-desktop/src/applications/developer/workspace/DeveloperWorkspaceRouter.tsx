/** Developer 工作区页签的四层装配入口。 */

import { SelUiWorkspaceTabs } from "../../../theme/SelUiWorkspaceTabs";
import { createDeveloperWorkspaceRouterViewModel } from "../model/createDeveloperWorkspaceRouterViewModel";
import type { DeveloperWorkspaceRouterProps } from "../model/developerWorkspaceRouterTypes";
import { useDeveloperWorkspaceRouterController } from "../model/useDeveloperWorkspaceRouterController";
import { DeveloperWorkspacePageSection } from "../sections/DeveloperWorkspacePageSection";

/**
 * 工作区路由只表达页签结构。
 *
 * 新手阅读顺序：Controller 处理导航，ViewModel 选择页面，Section 渲染真实 Feature。
 */
export function DeveloperWorkspaceRouter(props: DeveloperWorkspaceRouterProps) {
  // Controller 拥有页签切换、成员投影和令狐新建会话副作用。
  const controller = useDeveloperWorkspaceRouterController(props);
  // ViewModel 将当前路由转换为 SELUI 页签和页面区域可以直接使用的数据。
  const viewModel = createDeveloperWorkspaceRouterViewModel(controller);

  return (
    <SelUiWorkspaceTabs
      request={viewModel.requestedTab}
      revision={viewModel.revision}
      onActivate={viewModel.onActivate}
      renderPage={(pageId) => (
        <DeveloperWorkspacePageSection viewModel={viewModel.createPage(pageId)} />
      )}
    />
  );
}
