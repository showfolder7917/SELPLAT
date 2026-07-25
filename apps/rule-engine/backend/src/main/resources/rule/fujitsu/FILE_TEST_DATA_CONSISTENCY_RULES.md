# Fujitsu File Test Data Consistency Rules

## 说明

- 本规则适用于 Fujitsu 的 CP、IT、SB、AP 系文件测试数据。
- 本规则约束可变长文件定义、用例期待数据与业务查询结果之间的记录结构一致性。

## 文件定义与期待数据同步

<!-- 当文件测试工具同时使用 define JSON 和 testCase expect JSON 生成期待文件时加载；业务含义是两类 JSON 必须共同表达同一份文件记录结构 -->
rule_scope = fujitsu_file_test_define_and_expect_json_consistency

<!-- define.dataSections 与 expect.dataSections 必须同步增删对应数据段；业务含义是只修改期待值内容不会改变测试工具依据文件定义计算的期待行数 -->
file_define_and_expect_data_sections_must_be_synchronized = true

<!-- SQL 通过 ROW_NUMBER、DISTINCT、GROUP BY 或同类规则压缩结果记录时，文件定义和期待数据必须按实际输出记录数同步调整；业务含义是测试期待必须服从已确认的查询去重或分组语义 -->
query_result_cardinality_change_requires_file_test_section_sync = row_number,distinct,group_by

<!-- 文件断言完成前必须同时核对行数、字段值、编码和字段字节长度；业务含义是不能用超长、不可编码或其他非法输入绕过分组条件来制造表面通过 -->
file_assertion_data_validation = line_count + field_values + encoding + field_byte_length

