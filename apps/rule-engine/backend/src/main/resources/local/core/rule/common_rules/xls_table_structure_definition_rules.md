# Table Structure Definition XLS Rules

## 说明

- 本文件用于约束“表结构定义书 Excel / XLSX 模板”的生成与后续复用
- 本文件适用于用户要求“参照现有表结构定义书做通用模板、以后继续按模板出表结构定义”的场景
- 本文件聚焦工作簿结构、字段列头、表信息区与默认模板目录，不承接数据库设计本身的业务规则
- 若任务要求的是“数据库设计文档 xlsx 版”而不是单纯表结构定义书，应按数据库设计文档自身要求单独确认对应规则或交付方式，不要直接套用本规则

<!-- 本规则解决“只有单个项目表定义书，没有可复用通用模板和默认查找回路”的问题；适用于表结构定义 Excel 模板生成场景；业务含义是以后同类任务统一从正式模板目录取模板，并以专属键标识作用域避免跨文件覆盖 -->
table_structure_definition_xls_rule_scope = table_structure_definition_xls_generation

<!-- 表结构定义模板必须优先复用参考工作簿的页签骨架；适用于已有成熟定义书可参照的场景；业务含义是避免每次重新设计表定义版式 -->
table_structure_xls_must_prefer_reference_workbook_structure = true

<!-- 表结构定义工作簿必须至少包含表一览页、表定义页和模板说明/保留页；适用于通用表定义书场景；业务含义是同时承载总览、单表详情和模板说明 -->
table_structure_xls_required_sheet_roles = table_list,table_definition,template_note

<!-- 表结构定义页必须保留表信息区与字段信息区；适用于单表定义页；业务含义是让表级元信息和字段级元信息都能固定填写 -->
table_structure_xls_required_definition_sections = table_info,field_definition

<!-- 字段信息区必须保留序号、逻辑名、物理名、数据类型、非空、默认值、数据例和说明列；适用于通用字段定义场景；业务含义是保证建表、接口和测试信息都可追溯 -->
table_structure_xls_required_field_columns = no,logical_name,physical_name,data_type,not_null,default_value,sample_value,description

<!-- 表信息区必须保留系统名、子系统名、逻辑表名、物理表名、类别、编写者、编写日期、更新日和备注；适用于模板与正式定义书；业务含义是保证表定义书基本元信息完整 -->
table_structure_xls_required_table_metadata = system_name,subsystem_name,logical_table_name,physical_table_name,category,author,created_date,updated_date,remarks

<!-- 模板化时必须把业务专有表名、日期、作者和现状说明改为占位符或示例值；适用于从现有项目定义书提炼模板场景；业务含义是避免旧项目真实信息泄漏到新模板 -->
table_structure_xls_must_replace_project_specific_values_with_placeholders = true

<!-- 正式模板资产必须统一存放到 ai/rule/template 目录；适用于后续查找和持续复用场景；业务含义是防止模板继续散落在 human/xlsx 等临时目录 -->
table_structure_xls_canonical_template_dir = ${RUL}template

<!-- 当前通用表结构定义默认模板文件名固定为中文模板名；适用于默认查找场景；业务含义是让能力与规则都能稳定命中同一模板 -->
table_structure_xls_default_template_file = 表结构定义模板_通用.xlsx

<!-- 当任务要求继续生成表结构定义书而未显式指定模板时，必须优先从正式模板目录查找默认模板文件；适用于常规复用场景；业务含义是固定唯一模板入口 -->
table_structure_xls_must_lookup_default_template_from_canonical_dir_first = true

<!-- 中文模板必须优先使用中文页签和中文字段标签；适用于中文交付场景；业务含义是让模板直接可交付，而不是继续混用中日文字段 -->
table_structure_xls_template_should_use_chinese_sheet_names_and_labels = true

<!-- 模板必须保留可扩展空白行，不能只留下单条示例字段；适用于后续继续补字段场景；业务含义是减少再次改版式的成本 -->
table_structure_xls_should_keep_expandable_blank_rows = true

<!-- 表结构定义工作簿生成完成后必须执行结构检查和可视化预览验证；适用于正式表结构定义书交付；业务含义是避免只导出文件而不核对字段区和表信息区的实际可读性 -->
table_structure_xls_must_run_post_generation_structure_and_visual_verification = true

<!-- 表结构定义工作簿验证时必须检查表信息区、字段信息区和模板说明区已经替换为当前项目内容；适用于模板复制生成场景；业务含义是防止旧表名、旧系统名或示例说明残留 -->
table_structure_xls_must_verify_metadata_and_remove_sample_text = true

## 生成要求

1. 优先保留参考工作簿的样式骨架、合并单元格和区块位置，再清洗为模板。
2. 中文模板默认使用 `表一览`、`表定义_示例` 和 `模板说明` 页签。
3. `表一览` 页先列逻辑表名、物理表名、说明和备注，用于总览多张表。
4. `表定义_示例` 页承载单表元信息和字段明细，并预置 2-3 行示例字段占位。
5. `模板说明` 页用于说明本模板的用途、默认查找目录和复制使用方法。
6. 当任务未显式指定模板路径时，先从 `ai/rule/template/表结构定义模板_通用.xlsx` 查找。
7. 若后续需要补充更多表定义页，可按 `表定义_表名` 形式复制扩展，但列头结构必须保持一致。

## 使用说明

- 当用户要求“参照表结构定义书做模板”时，优先加载本规则。
- 当用户要求“以后按这个模板继续出表结构定义”时，默认以本规则约束模板目录、模板文件名和查找顺序。
- 若任务既要表结构定义模板又要详细设计模板，两类模板规则分别独立加载，不相互替代。
- 当任务是生成、重写或修复表结构定义书成品时，除本规则外，应同时加载 `common_rules/xls_output_test_rules.md` 做生成后验收。
