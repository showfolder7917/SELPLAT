# Code Vue Rules

## 说明

- 这是 Vue 规则的兼容入口文件。
- Vue 规则现已按 Java 风格拆成三块：
  - `CODE_VUE_FRONTEND_PROJECT_RULES.md`：架构与前端项目边界
  - `CODE_VUE_CODING_RULES.md`：编码与注释规范
  - `CODE_VUE_TEST_RULES.md`：测试与自动修复 bug 级验证
- 本文件只保留兼容入口和迁移提示，避免旧索引或旧引用直接断裂。

## 兼容规则（Compatibility）

<!-- 旧的 Vue 任务入口默认应切换到新的 Vue 编码规则文件 -->
legacy_vue_rule_entry_should_redirect_to_vue_coding_rules = CODE_VUE_CODING_RULES

<!-- 涉及 Vue 架构拆分、目录重构和分层边界时，应额外加载 Vue 前端项目规则 -->
load_vue_architecture_rules_for_vue_structure_refactor = CODE_VUE_FRONTEND_PROJECT_RULES

<!-- 涉及 Vue 测试、页面验证、页面结合验证和自动修复 bug 闭环时，应额外加载 Vue 测试规则 -->
load_vue_test_rules_for_vue_test_or_bug_fix_task = CODE_VUE_TEST_RULES

## 禁止事项（Forbidden）

<!-- 禁止继续把新增 Vue 规则只堆回本兼容文件，而不落到架构、编码或测试规则中 -->
forbid_adding_new_primary_vue_rules_only_into_legacy_compat_entry
