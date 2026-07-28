# CPMAB082 Project Style Rules

## 说明

- 本规则只适用于 Fujitsu 的 CPMAB082 工程，承接其 Java、Bean、Mapper 与 MyBatis SQL 实现细节。
- 本规则在 Fujitsu 共同工程风格之后按需加载；其中的 CPMAB081、CPMACOMMON 和字段契约不得推广到其他 CP、IT、SB、AP 工程。

## 适用范围

<!-- 本模块仅约束 CPMAB082 的 Java、Bean、Mapper 与 MyBatis SQL 实现；业务含义是防止把本项目专属参考工程、表契约或命名带入其他 Fujitsu 工程 -->
rule_scope = Fujitsu/CPMAB082/java_bean_mapper_sql

<!-- 本文件中的相对工程路径以 CPMAB082 工程根目录为基准；业务含义是参考工程和源码路径不得按 MEMORIES 目录错误拼接 -->
relative_path_base = CPMAB082_project_root

## 参考工程与实现风格

<!-- 批处理结构、依赖注入、异常处理、日志和批量分割优先参考 CPMAB081；业务含义是保持相邻批处理工程的一致实现方式 -->
batch_implementation_style_reference = ../CPMAB081

<!-- Mapper、Bean 与 SQL 的目录、类型和命名优先参考 CPMACOMMON；业务含义是复用 CPMA 公共持久层约定 -->
mapper_bean_sql_style_reference = ../CPMACOMMON

## Mapper 与 Bean 结构

<!-- CPMAB082 必须注入并使用公共 CPMAMapper；业务含义是禁止在批处理类中重新建立专用 Mapper 体系 -->
batch_must_use_public_cpma_mapper = src/main/java/jp/or/jasdec/sbf/cp/ma/parts/mapper/CPMAMapper.java

<!-- CPMAB082.java 中禁止内嵌 SQL Bean 或 Mapper 类；业务含义是保持业务编排与持久层定义分离 -->
forbid_nested_sql_bean_or_mapper_in_cpmab082 = true

<!-- SQL 输入输出 Bean 独立定义在 parts.bean.db 并继承 APZZSqlParamBase；业务含义是让 MyBatis 类型可复用且可定位 -->
sql_bean_location = src/main/java/jp/or/jasdec/sbf/cp/ma/parts/bean/db
sql_bean_base_type = APZZSqlParamBase

## SQL 与 Bean 命名

<!-- SQL ID 与 Mapper 方法使用 CPMAQ 加操作和既有业务缩写；业务含义是保证 Java 方法与 MyBatis statement 可直接对应 -->
sql_id_and_mapper_method_pattern = CPMAQ<Action><ExistingBusinessAbbreviation>

<!-- SQL Bean 复用对应 SQL ID 并按输入输出追加固定后缀；业务含义是从类型名即可追溯 SQL 契约 -->
sql_input_bean_pattern = <SqlId>InDataBean
sql_output_bean_pattern = <SqlId>OutDataBean

<!-- 发行业者组织名称统一复用 CPMACOMMON 的 IssuerOrgniNm 缩写；业务含义是禁止混用自由翻译 -->
issuer_organization_name_abbreviation = IssuerOrgniNm

## Mapper XML 追加规则

<!-- CPMAMapper.xml namespace 必须等于公共 Mapper 全限定类名；业务含义是保证方法可解析到对应 SQL -->
cpma_mapper_xml_namespace = jp.or.jasdec.sbf.cp.ma.parts.mapper.CPMAMapper

<!-- 新 SQL 必须以与 Mapper 方法一致的新 statement ID 追加；业务含义是禁止覆盖或暗改既有 SQL 行为 -->
new_sql_must_append_with_new_statement_id = true

<!-- 既有 SQL 正文不得修改；业务含义是保留原实现核对能力并控制回归范围 -->
forbid_modify_existing_sql_statement_body = true

<!-- 删除旧 Java 内嵌类型后，仅允许为 XML 类型解析调整旧 statement 元数据；业务含义是结构迁移不得改变旧 SQL 正文 -->
legacy_statement_metadata_may_change_only_for_type_resolution = true

## 字段与业务数据规则

<!-- Select、Bean 和 Insert 字段以 CPMAB082 的设计文档与表定义为事实来源；业务含义是禁止根据旧代码猜测字段 -->
sql_and_bean_fields_must_follow_project_design_and_table_definition = true

<!-- 原始组织名称与编辑后公司名必须分别保存；业务含义是同时保留正式名称和格付全量信息照合值 -->
preserve_original_orgni_nm_and_store_edited_value_in_co_edit_nm = true

<!-- 发行业者组织名称注册必须写入主键、原始值、编辑值和六个 AP 审计字段；业务含义是完整满足目标表契约 -->
issuer_orgni_nm_insert_required_fields = CO_CD,CP_ISSUER_CD,ORGNI_NM,CO_EDIT_NM,CRE_SYS_DATE_AP,CRE_OPE_DATE_AP,CRE_BIZ_FUNC_AP,UPD_SYS_DATE_AP,UPD_OPE_DATE_AP,UPD_BIZ_FUNC_AP

## 业务固有部品定义规则

<!-- 名称编辑等业务固有部品必须以项目指定的业务固有部品定义书为类名、包名、公开方法和注入依赖的事实来源；业务含义是禁止因已有近似实现而把专属部品错误生成到 AP 通用包 -->
business_component_definition_source = MEMORIES/human/fujitsu/<issue>/业务固有部品定義_*.xlsx

<!-- CPMA 业务固有部品必须放在 cp.ma.parts 下，APZZ 通用部品仅保留跨业务可复用能力；业务含义是保持业务规则与 AP 共通字符串操作的职责边界 -->
cpma_business_component_package = jp.or.jasdec.sbf.cp.ma.parts
forbid_cpma_specific_behavior_in_apzz_common_component = true

<!-- 业务固有名称编辑部品通过小驼峰字段注入 APZZStringUtil，并调用其通用字符串操作；业务含义是业务部品负责编排规则，APZZStringUtil 只提供 trim 等基础操作 -->
business_name_editor_string_utility_field = apzzStringUtil
business_component_must_delegate_generic_string_operations_to_apzz_string_util = true

<!-- 批处理调用方必须注入业务固有部品，不得直接调用 APZZStringUtil 执行业务名称编辑；业务含义是让设计书定义的部品成为唯一业务入口 -->
batch_must_inject_business_component_for_business_name_editing = true

## 注释与验证

<!-- 持久层交付至少验证目标编译、Checkstyle、XML、statement 注册和批量 Insert 绑定；业务含义是覆盖类型、风格、映射与运行参数契约 -->
required_mapper_change_verification = java_compile,checkstyle,xml_parse,mybatis_statement_registration,bound_sql_parameter_binding

<!-- 离线依赖缺失时先进入 Fujitsu 组织级公共恢复规则；业务含义是闭包重建、无网络边界和正常测试入口保持跨工程单一权威来源 -->
offline_dependency_shared_handling_rule = fujitsu/rule/RUL_FujitsuGradle离线依赖闭包恢复规则/RUL_FujitsuGradle离线依赖闭包恢复规则.md

<!-- CPMAB082 的只读参考工程和持久层替代验证差异由项目配置规则补充；业务含义是项目模块只维护自身特例 -->
offline_dependency_project_configuration_rule = fujitsu/rule/CPMAB082/RUL_CPMAB082离线依赖配置规则/RUL_CPMAB082离线依赖配置规则.md
