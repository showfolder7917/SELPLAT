# 静态前端结构

## 目录职责

```text
static/
├── sel/                         通用基础能力，不认识任何具体应用实体
│   ├── core/                    重置、可访问性、反馈和基础运行时
│   │   └── selAjax.js           通用请求发送与 JSON 返回能力
│   ├── components/              可显式挂载的通用 UI 控件
│   │   ├── date-picker/          标准日期值、水晶月历与键盘导航
│   │   ├── dropdown/
│   │   ├── grid/
│   │   ├── panel/
│   │   ├── search/
│   │   └── tree/
│   └── assets/                  通用背景、光标和控件专属网页素材
└── uniauth/                     统一认证应用
    ├── uniauth.html             资源入口和应用挂载点
    ├── uniauth.css              应用页面布局
    ├── uniauth.js               数据源声明和页面装配层
    └── mock/                    前端演示数据
```

## 调用边界

1. `sel` 基础控件只接收宿主节点、标准数据和通用选项。
2. `selAjax` 只执行调用方显式传入的地址并返回 JSON，不能保存具体应用接口、模拟目录或实体映射。
3. 其他 `sel` 基础控件不能请求具体应用接口、读取应用全局对象或识别 `UniauthUser` 等实体。
4. `uniauth.js` 可以识别业务实体，负责明确登记 mock 或后端地址，通过 `selAjax` 读取 payload，并在 `uniauthLayouts` 中声明上、左、中、右、下分别放哪个基础控件及使用哪份 JSON。
5. `selPanel.create` 只按基础组件白名单创建声明中的区域和宿主；`uniauth.js` 只挂载布局实际声明的控件，不直接创建内部 DOM。
6. 应用缺少所需基础控件时必须停止当前模块装配并报告缺失能力，不能直接在业务脚本中重新实现通用控件。
7. 基础控件内部必须使用原生语义元素实现键盘操作和无障碍；“禁止直接使用原生”是指应用层不能绕开基础控件另写一套通用 UI。

## 新增应用模块

1. 在应用目录增加模块宿主，并声明完整实例名、实体名、可选视图名和 `layoutId`。
2. 在 `mock/<BusinessControlInstance>/` 增加演示 payload；接入后端后保持相同聚合结构。
3. 在应用装配层逐项登记数据源真实路径和实例，不允许 `selAjax` 或其他基础控件根据实例名猜测地址。
4. 在布局注册表中按 `top、left、center、right、bottom` 声明基础控件，并用 `payload` 标明 `title、search、tree、menu、pagination、select` 等数据来源。
5. 由 `selPanel` 创建声明结构，再由应用装配层只挂载已经声明的树、菜单、下拉、搜索和表格。
6. 如果现有基础控件不能表达新能力，先在 `sel/components/<component>/` 建立基础控件和标准输入，再由应用调用。
7. 同页建立至少两个实例，验证筛选、树、菜单和分页互不影响。
