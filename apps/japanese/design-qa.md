# Japanese 页面设计 QA

- 参考图：`apps/japanese/design-reference.png`
- 实现地址：`http://127.0.0.1:8080/japanese/japanese.html`
- 目标视口：1808 × 1006
- 目标状态：空题库、glass-admin 深色主题、compact 密度
- HTTP 验证：页面、脚本、样式、题目列表和 reference-data 树均返回 200
- 自动化测试：Japanese、MDA、rule-engine 测试通过
- 视觉对照：未完成
- 阻断原因：Codex Desktop 内置浏览器控制进程启动时读取 `/System/Library/OpenSSL/openssl.cnf`，被系统权限拒绝并退出；因此无法取得同视口实现截图，也无法把参考图与实现图放入同一比较输入。
- 最终结果：blocked

视觉验收恢复后必须完成：打开实现页、截取 1808 × 1006 空题库状态、与参考图合并比较、修正可见差异并再次比较。HTTP 通过和静态截图不能替代该步骤。
