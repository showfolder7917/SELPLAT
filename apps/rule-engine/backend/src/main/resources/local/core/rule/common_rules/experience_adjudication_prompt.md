# Experience Adjudication Prompt Rules

## 说明

- 本文件用于约束经验治理中的裁决提示词。
- 本文件定义工作流程经验、设计经验、架构经验、单经验四层模型。
- 本文件同时定义查询时的提示词口径，允许高度抽象词与具体任务词混合使用。

<!-- 本规则解决当前经验治理只有工作流程结果、设计和架构结论不稳定、单经验被清空的问题；适用于经验裁决和经验查询提示词设计场景；业务含义是把经验沉淀稳定收敛为四层模型，并以专属键标识作用域避免跨文件覆盖 -->
experience_adjudication_rule_scope = experience_adjudication_and_query_prompt

<!-- 裁决时必须同时考虑工作流程经验 设计经验 架构经验和单经验四层；适用于正式记账后的经验治理；业务含义是禁止只保留某一层尤其只保留 workflow -->
adjudication_must_consider_four_layers = workflow,design,architecture,single

<!-- 单经验必须保留为原子证据层；适用于所有正式经验治理任务；业务含义是高层经验不能以删除单经验为代价生成 -->
single_experience_must_be_preserved = true

<!-- 工作流程经验允许来源于具体任务 但输出必须提炼为可复用流程；适用于任务复盘到流程沉淀场景；业务含义是避免把任务汇报直接当成 workflow -->
workflow_experience_must_be_reusable_process = true

<!-- 设计经验必须回答方案如何设计出来 包括字段 接口 规则 异常与取舍；适用于设计沉淀场景；业务含义是让 design 层承载方案逻辑而不是步骤 -->
design_experience_must_capture_design_reasoning = fields,interfaces,rules,error_handling,tradeoffs

<!-- 架构经验必须回答模块如何分层 协作 落库和组织关系；适用于模块级经验沉淀场景；业务含义是让 architecture 层承载结构结论而不是执行动作 -->
architecture_experience_must_capture_module_structure = layering,collaboration,persistence,boundaries

<!-- 查询提示词允许同时使用抽象词和具体任务词；适用于经验查询和召回场景；业务含义是提高高层经验与当前任务上下文的同时命中率 -->
query_prompt_may_mix_abstract_and_task_terms = true

<!-- 若内容只包含一次性结果而无复用步骤 不应派生 workflow；适用于 workflow 裁决；业务含义是控制 workflow 质量 -->
forbid_workflow_derivation_without_reusable_steps = true

<!-- 若内容没有设计取舍和结构约束 不应派生 design；适用于 design 裁决；业务含义是避免把实现记录误判为设计经验 -->
forbid_design_derivation_without_design_reasoning = true

<!-- 若内容没有模块边界或落库协作结论 不应派生 architecture；适用于 architecture 裁决；业务含义是避免把局部修复误判为架构经验 -->
forbid_architecture_derivation_without_structure_conclusion = true

## 裁决任务提示词

你现在要对一条正式记账经验进行裁决与分层沉淀。

你的目标不是只总结这次任务，而是判断这条经验应当保留在哪些层：
- 工作流程经验
- 设计经验
- 架构经验
- 单经验

请严格遵守以下口径：

1. 单经验必须保留。
2. 工作流程经验可以来源于某次任务，但必须提炼为“这类事通常怎么做”的可复用流程。
3. 设计经验必须说明方案是如何设计出来的，例如字段怎么定、接口怎么拆、异常怎么兜底、规则怎么落、为什么这样设计。
4. 架构经验必须说明模块最终如何分层、如何协作、如何落库、关系如何组织。
5. 如果某一层的语义证据不足，就不要机械派生那一层。
6. 不得把具体任务汇报直接改写成 workflow。
7. 不得把编码动作或结果汇报直接改写成 design。
8. 不得把局部修复直接改写成 architecture。

## 查询提示词口径

在设计经验查询提示词时，允许同时使用两类词：

- 高度抽象词：
  - 详细设计
  - 模块架构
  - 页面联调
  - 工作流程
  - 异常处理
  - 规则治理

- 具体任务词：
  - 当前任务名
  - 当前模块名
  - 关键表名
  - 关键接口名
  - 关键文件名

混合查询的目标是：
- 让高层经验能被召回
- 让当前任务上下文也能被召回
- 让高层结论和原子证据都可见

## 裁决输出模板

```text
【单经验】
- 是否保留：是
- 保留原因：...
- 证据摘要：...

【工作流程经验】
- 是否派生：是 / 否
- 判断理由：...
- 可复用流程：...
- 适用边界：...

【设计经验】
- 是否派生：是 / 否
- 判断理由：...
- 设计结论：...
- 关键取舍：...

【架构经验】
- 是否派生：是 / 否
- 判断理由：...
- 架构结论：...
- 模块边界 / 协作 / 落库关系：...

【查询提示词建议】
- 抽象词：...
- 具体任务词：...
- 混合查询串：...
```

## 使用说明

- 若任务是经验治理、经验裁决、经验分层或经验查询提示词设计，应优先加载本文件。
- 若后续存在在线裁决服务或自动治理脚本，应在生成裁决结论前先读取本文件。
- 若后续需要业务专项规则，应在本文件之上叠加，而不是覆盖四层基础语义。
