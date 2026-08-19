# AI软件工厂-全流程日志与审计规范

版本：V1.0

## 1. 目标

建立全流程可追溯审计体系。

任何需求从提出到交付完成，所有阶段必须记录日志。

日志属于系统核心资产。

禁止删除。

禁止修改历史日志。

---

# 2. 核心原则

META-RULE-002

任何状态迁移必须产生审计日志。

即：

需求
↓
架构
↓
详细设计
↓
开发
↓
测试
↓
门禁
↓
客户验收

每一步必须留下日志。

否则禁止进入下一阶段。

---

# 3. 日志的作用

日志用于回答以下问题：

- 谁执行的？
- 使用了哪个Agent？
- 输入了哪些文档？
- 产生了哪些结果？
- 为什么通过？
- 为什么失败？
- 哪个Gate放行？
- 客户为什么拒绝验收？

日志是复盘与审计的唯一事实来源。

---

# 4. 必须记录日志的阶段

## Requirement 阶段

记录：

- 创建时间
- 客户需求
- Requirement Agent
- requirement.md版本

---

## Architecture 阶段

记录：

- Architecture Agent
- 输入文档
- architecture.md版本
- 处理结果

---

## Design 阶段

记录：

- Design Agent
- design.md版本
- 修改内容摘要

---

## Development 阶段

记录：

- Development Agent
- 修改文件
- 修改函数
- 代码提交记录

---

## Test 阶段

记录：

- 测试用例数量
- PASS数量
- FAIL数量
- 覆盖率

---

## Gate 阶段

记录：

- Gate名称
- Gate版本
- Rule版本
- 检查结果

---

## Customer Verify 阶段

记录：

- 验收结果
- 客户反馈
- 验收时间

---

# 5. 状态迁移日志

每次状态变化必须记录。

例如：

NEW
↓
REQUIREMENT_READY
↓
ARCHITECTURE_READY
↓
DESIGN_READY
↓
IMPLEMENTING
↓
TESTING
↓
QUALITY_CHECKING
↓
CUSTOMER_VERIFY
↓
DONE

每个状态迁移必须产生一条日志。

---

# 6. 门禁日志

门禁日志属于重点审计对象。

记录：

- Gate名称
- Gate版本
- 检查项
- PASS/FAIL
- 检查时间

示例：

Gate: Design Gate
Result: PASS
Version: 1.3

---

# 7. 客户验收失败处理

客户验收失败时：

客户反馈
↓
记录验收日志
↓
启动复盘
↓
根因分析
↓
修复资产
↓
重新进入标准流水线

修复资产包括：

- Code Library
- Rule Library
- Gate Library
- Process Library

禁止绕过标准流程。

---

# 8. 复盘输入来源

复盘Agent只能使用：

- requirement.md
- architecture.md
- design.md
- test_result.md
- gate.md
- audit.log
- 客户反馈

日志是复盘的重要依据。

---

# 9. 日志分类

## 执行日志

记录Agent执行过程。

## 状态日志

记录状态迁移。

## 门禁日志

记录Gate检查过程。

## 验收日志

记录客户验收过程。

## 修复日志

记录问题修复过程。

---

# 10. 核心资产

AI软件工厂长期保留资产：

- Document Library
- Audit Log Library
- Rule Library
- Gate Library
- Process Library

其中：

文档 = 当前状态

日志 = 历史事实

规则 = 执行原则

门禁 = 执法机制

流程 = 治理机制

---

# 11. 核心理念

没有日志就没有审计。

没有审计就没有复盘。

没有复盘就没有改进。

所以：

全流程记录日志。

全流程可追溯。

全流程可复盘。