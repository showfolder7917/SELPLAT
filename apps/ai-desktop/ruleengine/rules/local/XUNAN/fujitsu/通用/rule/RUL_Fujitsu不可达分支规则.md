# Fujitsu Unreachable Branch Rules

## 说明

- 本规则适用于 Fujitsu 的 CP、IT、SB、AP 系 Java 工程。
- 本规则解决上游已经限定数据集合后，下游重复相同条件而形成不可达分支、误导 JaCoCo 覆盖率治理的问题。
- 删除判断前必须证明数据来源唯一、对象关键字段未在上下游之间发生变更，并通过相邻回归测试确认业务结果不变。

## 上游筛选与下游判断

<!-- 上游已经按同一字段和允许值完成筛选时，下游不得无业务依据地重复相同判断；业务含义是避免保留逻辑上不可达的 false 分支 -->
fujitsu_downstream_must_not_repeat_equivalent_upstream_filter_without_business_reason = true

<!-- 删除下游重复判断前必须验证数据只来自已确认的上游入口，且关键判定字段在两处之间没有赋值或变更；业务含义是防止以覆盖率为由误删仍具防御价值的校验 -->
duplicate_predicate_removal_requires_invariant_proof = single_upstream_source AND same_allowed_values AND no_intermediate_field_mutation

<!-- 无法用正式输入数据进入的分支必须先追踪前置过滤、格式转换和集合构建过程；业务含义是区分测试数据不足与代码自身不可达，禁止制造不符合字段契约的数据冒充覆盖 -->
uncovered_branch_requires_upstream_dataflow_trace_before_fixture_change = format_validation -> conversion_filter -> business_area_collection -> downstream_predicate

<!-- 确认分支不可达后应删除冗余判断并保留业务注释说明上游不变量；业务含义是让后续维护者知道直接处理数据的安全前提，而不是误以为遗漏校验 -->
unreachable_duplicate_branch_fix = remove_redundant_predicate + document_upstream_invariant + run_adjacent_regression + recollect_jacoco
