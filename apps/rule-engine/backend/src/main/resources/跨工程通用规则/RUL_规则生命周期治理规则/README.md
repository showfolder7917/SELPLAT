# 规则生命周期治理规则包

## 主入口

- `RUL_规则生命周期治理规则.md`：规则新增、生成、移动、合并、退役、索引维护和同名规则包结构的唯一主规则。

## 生成入口

- 通过 `${MEMORY_CODE_ROOT}/executor.py` 调用 `rule_package_generator`。
- `plan` 返回同名规则包、同名主规则和索引登记计划，不产生文件。
- `generate` 在全部校验通过后创建规则包并向 `RULE_INDEX.md` 追加主规则入口。

本规则包没有独立模板或项目配置；后续新增关联资产时必须使用 `docs/`、`template/`、`examples/` 或 `project/` 标准子目录。
