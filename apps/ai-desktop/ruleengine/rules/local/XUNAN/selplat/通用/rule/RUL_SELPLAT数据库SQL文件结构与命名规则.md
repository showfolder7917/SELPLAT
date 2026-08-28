# SELPLAT 数据库 SQL 文件结构与命名规则

<!-- 本规则的 Hikari、H2 文件、号段、DAO/Service 与单表 SQL 约束只作用于中央登记的 java-gradle+h2 条目。 -->
selplat_database_sql_rule_h2_scope = central_registration(runtimeType=java-gradle,databaseEngine=h2)
<!-- 中央登记的 electron+sqlite 条目复用 db/sql 归属，但迁移、连接和恢复合同由对应 Electron 应用规则治理。 -->
selplat_database_sql_rule_sqlite_scope = central_registration(runtimeType=electron,databaseEngine=sqlite)+application_persistence_rule

<!-- 当前规则不需要 Java 专用能力；应用现有数据库初始化器和测试任务直接承担执行验证。 -->
java_ability_refs = none
<!-- 当前规则不需要 Python 专用能力；目录、文件名和 SQL 引用可由现有检索与构建入口验证。 -->
python_ability_refs = none
<!-- 当前规则不需要 Node 专用能力；Node 只在受影响前端字段同步时使用现有语法检查。 -->
node_ability_refs = none
<!-- 首版规则固化 reference-data 重构中已经验证的 SQL 目录和单表文件约束。 -->
rule_version = 2.18.0
<!-- 规则所有者始终来自工程根 AGENTS.md 的当前稳定用户声明，未经人工提升不得扩大到 common。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示规则已完成索引登记、真实案例核对和索引链验证。 -->
rule_status = active

<!-- 问题：数据库脚本使用含义模糊的 tables 或 migration 文件名、一个文件创建多张正式表、类型表混入树或选项能力字段时，后续维护者无法从目录和文件名判断真实职责。 -->
<!-- 场景：当前稳定用户在 SELPLAT 中新建、迁移、拆分、改名或审查 apps/<app> 的应用自有数据库和 SQL。 -->
<!-- 业务含义：数据库文件、表名和代码调用保持一一可追踪，类型、树、选项等不同数据职责不会重新混入同一张表或同一个建表文件。 -->

## 规则包组成

<!-- 本规则的格式由 DSL 本身和文件命名模式直接固定，没有独立可复用成品模板，禁止为补齐目录生成空模板。 -->
template_not_applicable_reason = sql_layout_and_filename_patterns_are_fully_declared_in_rule_no_separate_artifact_template
<!-- reference-data 已完成真实数据库升级、回归和页面验证，可作为规则首个已核验正确案例。 -->
verified_example_refs = apps/reference-data/db/sql/schema-CommonSequenceSegment.sql
<!-- verified_example_refs.2 的当前独立事实为 apps/reference-data/db/sql/data-CommonSequenceSegment.sql。 -->
verified_example_refs.2 = apps/reference-data/db/sql/data-CommonSequenceSegment.sql
<!-- verified_example_refs.3 的当前独立事实为 apps/reference-data/db/sql/schema-ReferenceDataType.sql。 -->
verified_example_refs.3 = apps/reference-data/db/sql/schema-ReferenceDataType.sql
<!-- verified_example_refs.4 的当前独立事实为 apps/reference-data/db/sql/schema-ReferenceDataTreeNode.sql。 -->
verified_example_refs.4 = apps/reference-data/db/sql/schema-ReferenceDataTreeNode.sql
<!-- verified_example_refs.5 的当前独立事实为 apps/reference-data/db/sql/schema-ReferenceDataTable.sql。 -->
verified_example_refs.5 = apps/reference-data/db/sql/schema-ReferenceDataTable.sql
<!-- verified_example_refs.6 的当前独立事实为 apps/reference-data/db/README.md。 -->
verified_example_refs.6 = apps/reference-data/db/README.md
<!-- 当前验证复用应用数据库初始化器、Gradle 测试和 SQL 元数据查询，不重复建设只包装命令的专用程序。 -->
program_not_applicable_reason = existing_application_initializer_gradle_tests_and_database_metadata_queries_provide_repeatable_verification
<!-- 交付时必须同时验证目录结构、文件与表名映射、加载清单、隔离数据库执行和调用方字段引用。 -->
verification_scope = directory_layout
<!-- verification_scope.2 的当前独立事实为 filename_table_mapping。 -->
verification_scope.2 = filename_table_mapping
<!-- verification_scope.3 的当前独立事实为 loader_registry。 -->
verification_scope.3 = loader_registry
<!-- verification_scope.4 的当前独立事实为 isolated_database_execution。 -->
verification_scope.4 = isolated_database_execution
<!-- verification_scope.5 的当前独立事实为 caller_field_references。 -->
verification_scope.5 = caller_field_references
<!-- verification_scope.6 的当前独立事实为 relevant_tests。 -->
verification_scope.6 = relevant_tests

<!-- 原逻辑 ID 保留为兼容聚合入口，并显式加载已拆分的职责规则。 -->
requires_rule_ids = SELPLAT_DATABASE_ROOT_AND_RUNTIME_REGISTRATION_RULES,SELPLAT_DATABASE_SCHEMA_TABLE_MODEL_RULES,SELPLAT_DATABASE_SEQUENCE_AND_CODE_RULES,SELPLAT_DATABASE_SQL_SYNC_AND_RECOVERY_RULES,SELPLAT_DATABASE_DESTRUCTIVE_CHANGE_AND_EVIDENCE_RULES
