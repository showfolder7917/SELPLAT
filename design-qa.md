# 专题演化单树工作台 Design QA

## 对照证据

- source visual truth path：`/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-6961a48a-b816-47f2-9ef9-95d0a688c799.png`
- implementation screenshot path：`/Users/showfolder/Documents/workSpace/SELF/SELPLAT/OPTION/temp/ai-desktop/临时材料/设计验证/reset-data-single-tree-01a042e7/implementation-final.png`
- combined comparison path：`/Users/showfolder/Documents/workSpace/SELF/SELPLAT/OPTION/temp/ai-desktop/临时材料/设计验证/reset-data-single-tree-01a042e7/source-implementation-final-comparison.png`
- viewport：实现为真实 Electron 专题窗口 `1320 × 852` CSS px，`deviceScaleFactor=1`；来源为用户截图裁切 `582 × 738` px。
- density normalization：来源保持比例缩放到 `672 × 852`，实现保持 `1320 × 852`，横向并列为 `1992 × 852`；不以来源裁切宽度推断完整窗口比例。
- state：深色主题、南宫婉视角、当前专题选中；实现已按用户明确要求把来源的模块列与流程列合并为一棵左树，右侧内容保持同一业务状态。

## Full-view comparison evidence

- 信息架构：来源的两列导航已合并为单一层级树，右侧成为唯一内容区；模块、人工/自动分组和页面叶子仍保持原有顺序与层级。
- 字体与排版：沿用既有 SELUI 字体、字号、字重和行高；标题、分组、叶子、计数徽标和右侧表格的层级与来源一致，没有异常换行或截断。
- 间距与布局节奏：左树宽度约占窗口四分之一，分隔线清晰；缩进、节点高度、选中块、右侧页头与表格间距延续来源节奏。滚动只发生在树内容区，不遮挡右侧内容。
- 色彩与视觉令牌：深色背景、青色栏目文字、蓝紫渐变选中态、深蓝计数徽标和边框全部复用现有主题令牌；没有引入独立页面皮肤。
- 图像与资产质量：页面没有照片或品牌插画；树图标继续使用现有正式图标库，没有以文本符号、手绘 SVG 或占位图替代。
- 文案：模块、流程、审批、发布、恢复和档案名称与来源一致；新增“功能与流程”只用于准确描述合并后的单树职责。
- 交互：父节点显示明确总览，叶子节点切换对应右侧页面；树展开状态在节点选择后保持，人物视角切换恢复到该人物默认页面。

## Focused region comparison evidence

左侧树是唯一需要精读的密集区域，已经在 `1992 × 852` 原始并列图中按原始实现像素检查，文字、徽标、缩进、分隔线与选中态均清晰，因此未另做会降低上下文完整性的裁切图。

## Findings

- 无剩余 P0、P1 或 P2 问题。
- P3：当用户主动展开全部分支时左树需要纵向滚动；这是单树承载全部页面后的预期行为，滚动条位于导航区内且不遮挡永久操作。

## Comparison history

1. 初版合并后所有一级分支默认展开，树在默认状态产生不必要的长滚动。
2. 修正为只默认展开当前“专题演化”路径，并调整树控制器，使选择节点不再重建树、用户展开状态能够保持。
3. 后续真实 Electron 截图确认：人物分支可保持折叠，专题人工与自动分组完整可见；交互遍历后审计分支保持用户已展开状态，右侧内容无挤压、遮挡或横向溢出。

## Implementation Checklist

- [x] 单棵 SELUI 树替代模块列与流程列。
- [x] 父节点总览、分组页面与全部叶子路由可点击。
- [x] 左树右内容两列布局覆盖默认窗口和窄窗口规则。
- [x] 字体、间距、颜色、图标和业务文案沿用来源与现有主题。
- [x] 真实 Electron 逐项交互与截图证据已生成。

final result: passed
