# selCursor 水晶发光鼠标 Design QA

## QA 对象

- 用户参考：`/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-394db1c0-76b1-4cdc-aa0a-e4d26a03191f.png`
- 最终素材：`apps/uniauth/backend/src/main/resources/static/uniauth/misc/assets/cursor/selCursorCrystalPointer.png`
- 同屏对比：`OPTION/temp/selCursor-reference-comparison-2026-07-31.png`
- 页面截图：`OPTION/temp/selCursor-page-final-2026-07-31.png`
- 实现页面：`apps/uniauth/backend/src/main/resources/static/uniauth/demo/grid/grid.html`
- 验收日期：2026-07-31

## 实现结果

- 指针保持参考图的黑色箭头主体、暖白描边和蓝色外发光。
- 最终 PNG 为 48 × 48，包含透明通道，没有携带参考图的深蓝方形背景。
- CSS 点击热点为 `(5, 5)`，对应箭头左上方尖端。
- 页面背景、按钮、菜单和表格区域统一使用水晶指针。
- 搜索框、日期输入和其他文本编辑区域继续使用系统文本光标。

## 视觉对比

| 检查项 | 参考图 | 最终素材 | 结论 |
| --- | --- | --- | --- |
| 轮廓 | 向右下倾斜的黑色箭头 | 方向、比例与缺口形态保持一致 | 通过 |
| 描边 | 暖白色柔和描边 | 保留暖白描边，并在小尺寸下保持清楚 | 通过 |
| 发光 | 深蓝背景上的蓝色柔光 | 透明素材自带蓝色外发光，可适配不同深色区域 | 通过 |
| 背景 | 截图包含深蓝方块 | 最终四角透明，不产生方形贴片 | 通过 |
| 尺寸 | 截图画布 91 × 91 | 浏览器资源 48 × 48，视觉主体约 38px | 通过 |

最终素材比低分辨率参考图边缘更清晰；这是为浏览器实际显示进行的必要抗锯齿处理，不改变指针造型与发光语言。

## 浏览器验证

| 区域 | 计算后 cursor | 结果 |
| --- | --- | --- |
| 页面背景 | `url(...selCursorCrystalPointer.png?v=20260731-2) 5 5, auto` | 通过 |
| 普通按钮 | `url(...selCursorCrystalPointer.png?v=20260731-2) 5 5, auto` | 通过 |
| 搜索输入框 | `text` | 通过 |

- 页面现有筛选、下拉菜单、树导航和上下文菜单交互未被鼠标样式阻断。
- 最终页面控制台 error/warning：0。
- 鼠标 PNG 与 `selCursor.css` 均返回 HTTP 200。
- 浏览器截图接口不记录系统鼠标位置，因此页面结构截图与指针素材同屏对比被分别保留。

## 最终结论

未发现未解决的 P0、P1 或 P2 问题。指针视觉与用户参考一致，透明边缘、点击热点、文本输入例外和公共资源分层均符合预期。

final result: passed
