# AI软件工厂-Agent组织架构与职责规范

版本：V1.0

## 1. 设计原则

核心原则：

- 一个角色对应一个Agent
- 一个Agent只负责一个职责领域
- Agent不得跨越职责边界
- 所有产出必须经过对应门禁Agent检查
- 问题在哪一层产生，就在哪一层修复

---

# 2. Agent组织架构

客户
↓
Requirement Agent
↓
Architecture Agent
↓
Architecture Gate Agent
↓
Design Agent
↓
Design Gate Agent
↓
Development Agent
↓
Code Gate Agent
↓
Test Agent
↓
Test Gate Agent
↓
Quality Gate Agent
↓
Release

---

# 3. 生产体系Agent

## Requirement Agent

角色：需求分析师

职责：

- 整理需求
- 补全需求
- 输出验收标准

输出文档：

- requirement.md

---

## Architecture Agent

角色：解决方案架构师

职责：

- 总体架构设计
- 模块划分
- 技术方案设计
- 风险分析

输出文档：

- architecture.md

---

## Design Agent

角色：系统设计师

职责：

- 详细设计
- 接口设计
- 数据结构设计
- 文件与函数定位

输出文档：

- design.md

---

## Development Agent

角色：开发工程师

职责：

- 编码实现
- 代码重构
- 缺陷修复

输出：

- source code
- execution.md

---

## Test Agent

角色：验证工程师

职责：

- 单元测试
- 集成测试
- 覆盖率统计
- 测试报告生成

输出文档：

- test_result.md

---

# 4. 门禁体系Agent

## Architecture Gate Agent

角色：架构评审官

检查内容：

- 架构完整性
- 技术方案合理性
- 风险分析

输出：

- architecture_gate.md

---

## Design Gate Agent

角色：设计评审官

检查内容：

- 文件定位
- 函数定位
- 接口设计
- 数据结构设计

输出：

- design_gate.md

---

## Code Gate Agent

角色：代码评审官

检查内容：

- 编码规范
- 安全问题
- 超范围修改
- 设计一致性

输出：

- code_gate.md

---

## Test Gate Agent

角色：测试评审官

检查内容：

- 测试通过率
- 覆盖率
- 边界测试
- 异常测试

输出：

- test_gate.md

---

## Quality Gate Agent

角色：质量总审官

检查内容：

- 文档完整性
- 审计完整性
- 流程完整性
- 所有门禁结果

输出：

- gate.md
- release.md

最终裁决：

- PASS
- FAIL

---

# 5. 修复体系Agent

## Architecture Fix Agent

负责修复：

- architecture.md

处理问题：

- 架构缺陷
- 技术路线错误
- 模块划分错误

---

## Design Fix Agent

负责修复：

- design.md

处理问题：

- 设计遗漏
- 接口遗漏
- 数据结构问题

---

## Code Fix Agent

负责修复：

- 代码实现问题

处理问题：

- Bug
- 编译失败
- 测试失败

---

## Rule Fix Agent

负责修复：

- Rule Library

处理问题：

- 规则失效
- 规则冲突
- 规则重复

---

## Gate Fix Agent

负责修复：

- Gate Library

处理问题：

- 门禁漏检
- 门禁逻辑错误

---

## Process Fix Agent

负责修复：

- Process Library

处理问题：

- 流程缺陷
- 角色职责冲突
- 审批链问题

---

# 6. 进化体系Agent

## Retrospective Agent

职责：

- 根因分析
- 经验总结
- 失败复盘

输出：

- retrospective.md

---

## Rule Agent

职责：

- 新增规则
- 合并规则
- 删除失效规则

输出：

- rule_update.md

---

## Gate Agent

职责：

- 新增门禁
- 强化门禁
- 优化检查逻辑

输出：

- gate_update.md

---

## Process Improvement Agent

职责：

- 优化流程
- 调整生命周期
- 优化组织结构

输出：

- process_update.md

---

# 7. 问题路由机制

实现问题
→ Code Fix Agent

设计问题
→ Design Fix Agent

架构问题
→ Architecture Fix Agent

规则问题
→ Rule Fix Agent

门禁问题
→ Gate Fix Agent

流程问题
→ Process Fix Agent

---

# 8. 核心理念

生产Agent负责创造。

门禁Agent负责检查。

修复Agent负责纠正。

进化Agent负责成长。

所有问题最终沉淀为：

- Rule Library
- Gate Library
- Process Library

形成持续进化的AI软件工厂。