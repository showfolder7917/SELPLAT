"""验证 Python 分层加载器的索引、优先级、依赖和安全闭锁。"""

from __future__ import annotations

# 导入 importlib，从生产文件路径加载唯一 Python 分层加载能力。
import importlib.util
# 导入 sys，满足 dataclass 在模块初始化阶段的真实模块回查。
import sys
# 导入 unittest，复用工程统一 Python 测试入口。
import unittest
# 导入 Path，从测试位置向上识别工程根。
from pathlib import Path


# 工程根从 settings.gradle 动态识别，禁止测试绑定机器路径。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 生产能力固定在 core abilities，由注册表和 executor 统一调用。
ABILITY_PATH = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/abilities"
    / "layered_rule_loader.py"
)


def load_module():
    """加载生产模块，并先登记 sys.modules 以支持 dataclass。"""

    module_name = "layered_rule_loader_test_module"
    spec = importlib.util.spec_from_file_location(module_name, ABILITY_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载 Python 分层加载器：{ABILITY_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


loader = load_module()


class PythonLayeredRuleLoaderTest(unittest.TestCase):
    """覆盖原 Java 加载器全部生产边界和迁移后的 Python 入口。"""

    def test_loads_core_and_current_user_scope_rules(self) -> None:
        """core 与当前用户跨工程、SELPLAT 规则按登记路径加载。"""

        core_rule = loader.load("CODE_JAVA_CODING_RULES")
        self.assertEqual("core", core_rule.layer)
        self.assertEqual(
            "local/core/rule/CODE_JAVA_CODING_RULES.md",
            core_rule.resource_path,
        )
        self.assertIn("Java", core_rule.content)

        cross_rule = loader.load_for_current_user(
            "RULE_LIFECYCLE_GOVERNANCE_RULES", None
        )
        self.assertEqual(loader.current_stable_user_id(), cross_rule.layer)
        self.assertEqual(
            "local/XUNAN/跨工程通用规则/RUL_规则生命周期治理规则.md",
            cross_rule.resource_path,
        )

        scope_rule = loader.load_for_current_user(
            "SELPLAT_PROJECT_BUILD_RULES", "selplat"
        )
        self.assertEqual(loader.current_stable_user_id(), scope_rule.layer)
        self.assertEqual(
            "local/XUNAN/selplat/通用/rule/RUL_SELPLAT工程构建规则.md",
            scope_rule.resource_path,
        )

    def test_loads_current_user_rules_in_one_bundle(self) -> None:
        """common 迁空后，同一任务集合的业务规则全部由当前用户层承载。"""

        bundle = loader.load_bundle_for_current_user(
            [
                "SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES",
                "SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES",
            ],
            "selplat",
        )
        active_user = loader.current_stable_user_id()
        self.assertEqual(
            active_user,
            bundle.rules[
                "SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES"
            ].effective_rule.layer,
        )
        self.assertEqual(
            active_user,
            bundle.rules[
                "SELPLAT_REAL_DATABASE_INTEGRATION_TEST_RULES"
            ].effective_rule.layer,
        )
        self.assertTrue(
            any(
                "local/XUNAN/selplat/通用/rule/RUL_SELPLAT真实数据集成测试规则.md"
                in line
                for line in bundle.receipt
            )
        )

    def test_current_user_governance_is_single_active_layer(self) -> None:
        """common 迁空后，治理规则只保留当前用户这一条活跃业务层。"""

        active_user = loader.current_stable_user_id()
        stack = loader.load_rule_stack(
            "ACTIVE_USER_RULE_AND_CODE_OWNERSHIP_RULES",
            "selplat",
            active_user,
        )
        self.assertEqual((active_user,), tuple(item.layer for item in stack.layers))
        self.assertEqual(
            "active_user",
            stack.effective_values["rule_conflict_winner"],
        )
        self.assertEqual(
            "reserved_empty",
            stack.effective_values["common_resource_status"],
        )
        self.assertEqual("extend", stack.override_mode)

    def test_applies_extend_by_default_and_replace_only_when_explicit(self) -> None:
        """默认 extend 只覆盖同名键，显式 replace 才清空低层有效值。"""

        common = self._loaded_rule(
            "TEST_LAYER_RULE", "common", "common_only = keep\nshared_key = common"
        )
        user = self._loaded_rule(
            "TEST_LAYER_RULE", "TESTUSER", "shared_key = user\nuser_only = keep"
        )
        extended = loader.merge_rule_stack("TEST_LAYER_RULE", [common, user])
        self.assertEqual("keep", extended.effective_values["common_only"])
        self.assertEqual("user", extended.effective_values["shared_key"])
        self.assertEqual("extend", extended.override_mode)

        replacement = self._loaded_rule(
            "TEST_LAYER_RULE",
            "TESTUSER",
            "override_mode = replace\nuser_only = replace-result",
        )
        replaced = loader.merge_rule_stack("TEST_LAYER_RULE", [common, replacement])
        self.assertEqual(2, len(replaced.layers))
        self.assertNotIn("common_only", replaced.effective_values)
        self.assertEqual("replace-result", replaced.effective_values["user_only"])
        self.assertEqual("replace", replaced.override_mode)

    def test_resolves_dependencies_and_rejects_dependency_cycle(self) -> None:
        """显式依赖按拓扑顺序加载，共享依赖去重且循环立即阻断。"""

        rules = {
            "TEST_DEP_RULE": self._rule_stack("TEST_DEP_RULE", "dep_value = loaded"),
            "TEST_ROOT_RULE": self._rule_stack(
                "TEST_ROOT_RULE",
                "requires_rule_ids = TEST_DEP_RULE\nroot_value = loaded",
            ),
        }
        bundle = loader.assemble_bundle(["TEST_ROOT_RULE"], rules.get)
        self.assertEqual(
            ["TEST_DEP_RULE", "TEST_ROOT_RULE"], list(bundle.rules)
        )

        cyclic_rules = {
            "TEST_A_RULE": self._rule_stack(
                "TEST_A_RULE", "requires_rule_ids = TEST_B_RULE"
            ),
            "TEST_B_RULE": self._rule_stack(
                "TEST_B_RULE", "requires_rule_ids = TEST_A_RULE"
            ),
        }
        with self.assertRaises(loader.RuleLoadingError):
            loader.assemble_bundle(["TEST_A_RULE"], cyclic_rules.get)

    def test_reserved_common_loads_user_rule_and_rejects_unsafe_inputs(self) -> None:
        """预留空 common 不阻断用户规则，身份和作用域路径逃逸仍在读取前阻断。"""

        fujitsu_rule = loader.load_for_current_user(
            "FUJITSU_CPMAB082_PROJECT_STYLE_RULES", "fujitsu"
        )
        self.assertEqual(
            "local/XUNAN/fujitsu/应用/CPMAB082/rule/RUL_CPMAB082项目风格规则.md",
            fujitsu_rule.resource_path,
        )
        with self.assertRaises(loader.RuleLoadingError):
            loader.load("FUJITSU_CPMAB082_PROJECT_STYLE_RULES", "selplat")
        with self.assertRaises(ValueError):
            loader.load("CODE_JAVA_CODING_RULES", active_user="../invalid-user")
        with self.assertRaises(ValueError):
            loader.load("SELPLAT_PROJECT_BUILD_RULES", "selplat/../fujitsu")
        with self.assertRaises(loader.RuleLoadingError):
            loader.load(
                "UNREGISTERED_RULE",
                "selplat",
                loader.current_stable_user_id(),
            )

    def test_validates_complete_production_index_trees(self) -> None:
        """生产根/common 和当前用户索引全部可达且计数稳定。"""

        common_validation = loader.validate_index_tree()
        self.assertEqual(loader.IndexValidation(2, 11), common_validation)
        user_validation = loader.validate_current_user_index_tree()
        self.assertEqual(loader.IndexValidation(21, 72), user_validation)

    def test_loads_fujitsu_json_single_line_format_gate(self) -> None:
        """Fujitsu JSON 变更必须从当前用户层命中单行格式交付门禁。"""

        rule = loader.load(
            "FUJITSU_JSON_SINGLE_LINE_FORMAT_GATE_RULES",
            "fujitsu",
            loader.current_stable_user_id(),
        )
        self.assertEqual(loader.current_stable_user_id(), rule.layer)
        self.assertIn(
            "fujitsu_json_single_line_delivery_gate = valid_utf8_json AND physical_line_count_equals_1 AND no_cr_or_lf",
            rule.content,
        )

    def test_rejects_invalid_recursive_index_graphs(self) -> None:
        """循环、重复 ID、越界、缺失和深度超限都以非成功结果闭锁。"""

        cycle = self._base_index_graph(
            "SCOPE_INDEX = local/test/cycle/scope/RULE_INDEX.md"
        )
        cycle["local/test/cycle/scope/RULE_INDEX.md"] = (
            "CHILD_INDEX = local/test/cycle/child/RULE_INDEX.md"
        )
        cycle["local/test/cycle/child/RULE_INDEX.md"] = (
            "BACK_INDEX = local/test/cycle/scope/RULE_INDEX.md"
        )

        duplicate = self._base_index_graph(
            "SCOPE_INDEX = local/test/duplicate/scope/RULE_INDEX.md"
        )
        duplicate["local/test/duplicate/scope/RULE_INDEX.md"] = (
            "DUPLICATE_RULE = local/common/test/RUL_父规则.md\n"
            "CHILD_INDEX = local/test/duplicate/child/RULE_INDEX.md"
        )
        duplicate["local/test/duplicate/child/RULE_INDEX.md"] = (
            "DUPLICATE_RULE = local/common/test/RUL_子规则.md"
        )

        escaping = {
            "RULE_INDEX.md": "COMMON_RULE_INDEX = local/common/RULE_INDEX.md",
            "local/common/RULE_INDEX.md": (
                "ESCAPING_INDEX = local/common/../outside/RULE_INDEX.md"
            ),
        }
        missing = self._base_index_graph(
            "MISSING_INDEX = local/test/missing/RULE_INDEX.md"
        )
        deep = self._base_index_graph(
            "DEEP_INDEX = local/test/depth/0/RULE_INDEX.md"
        )
        for depth in range(18):
            deep[f"local/test/depth/{depth}/RULE_INDEX.md"] = (
                f"NEXT_INDEX = local/test/depth/{depth + 1}/RULE_INDEX.md"
            )

        for graph in (cycle, duplicate, escaping, missing, deep):
            with self.subTest(graph=list(graph)):
                with self.assertRaises((loader.RuleLoadingError, KeyError)):
                    self._validate_graph(graph)

    def test_executor_contract_returns_structured_result_and_nonzero_block(self) -> None:
        """ability 入口返回可序列化结果，非法逻辑 ID 明确标记 blocked。"""

        result = loader.execute(
            {
                "action": "load",
                "logical_id": "SELPLAT_PROJECT_BUILD_RULES",
                "active_scope": "selplat",
                "active_user": loader.current_stable_user_id(),
            },
            {},
            {},
        )
        self.assertEqual("completed", result["status"])
        self.assertEqual(loader.current_stable_user_id(), result["result"]["layer"])
        blocked = loader.execute(
            {"action": "load", "logical_id": "../invalid"}, {}, {}
        )
        self.assertEqual("blocked", blocked["status"])
        self.assertEqual(1, blocked["exit_code"])

    def test_reuses_unchanged_utf8_resource_snapshot(self) -> None:
        """同一 Python 进程重复加载未变化资源时命中缓存，减少磁盘读取。"""

        loader._read_resource_snapshot.cache_clear()
        loader.load_for_current_user("SELPLAT_PROJECT_BUILD_RULES", "selplat")
        first = loader._read_resource_snapshot.cache_info()
        loader.load_for_current_user("SELPLAT_PROJECT_BUILD_RULES", "selplat")
        second = loader._read_resource_snapshot.cache_info()
        self.assertGreater(second.hits, first.hits)

    def test_python_is_the_only_layered_loading_implementation(self) -> None:
        """根索引和注册表只登记 Python，Java 源码、测试与 fallback 均已清理。"""

        backend_root = PROJECT_ROOT / "apps/rule-engine/backend"
        root_index = (backend_root / "src/main/resources/RULE_INDEX.md").read_text(
            encoding="utf-8"
        )
        registry = (
            backend_root
            / "src/main/resources/local/core/registry/abilities.json"
        ).read_text(encoding="utf-8")
        self.assertIn(
            "core_layered_rule_loader = ../python/com/sp/selplat/local/code/core/abilities/layered_rule_loader.py",
            root_index,
        )
        self.assertIn('"layered_rule_loader"', registry)
        self.assertFalse(
            (
                backend_root
                / "src/main/java/com/sp/selplat/local/code/core/rule/LayeredRuleLoader.java"
            ).exists()
        )
        self.assertFalse(
            (
                backend_root
                / "src/test/java/com/sp/selplat/local/code/core/rule/LayeredRuleLoaderTest.java"
            ).exists()
        )

    @staticmethod
    def _base_index_graph(common_index_content: str) -> dict[str, str]:
        """构造根与 common 汇总的最小合法内存索引图。"""

        return {
            "RULE_INDEX.md": "COMMON_RULE_INDEX = local/common/RULE_INDEX.md",
            "local/common/RULE_INDEX.md": common_index_content,
        }

    @staticmethod
    def _validate_graph(resources: dict[str, str]):
        """使用内存 provider 验证异常索引，不写入生产 resources。"""

        def provider(resource_path: str) -> str:
            if resource_path not in resources:
                raise loader.RuleLoadingError(
                    f"test index not found: {resource_path}"
                )
            return resources[resource_path]

        return loader.validate_index_tree("RULE_INDEX.md", provider)

    @staticmethod
    def _loaded_rule(logical_id: str, layer: str, content: str):
        """构造专用于合并算法测试的内存规则层。"""

        return loader.LoadedRule(
            logical_id,
            layer,
            f"local/{layer}/test/{logical_id}.md",
            content,
        )

    @classmethod
    def _rule_stack(cls, logical_id: str, content: str):
        """把单层规则转换为依赖组装器可使用的规则栈。"""

        return loader.merge_rule_stack(
            logical_id, [cls._loaded_rule(logical_id, "common", content)]
        )


if __name__ == "__main__":
    unittest.main()
