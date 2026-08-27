"""规则主文件与叶子索引生成能力测试。"""

from __future__ import annotations

# 导入模块加载工具，直接验证能力文件的公开执行入口。
import importlib.util
# 导入临时目录工具，保证生成测试不会修改真实规则资源。
import tempfile
# 导入 unittest，使用现有能力测试统一框架。
import unittest
# 导入 Path，构造临时规则目录和断言文件路径。
from pathlib import Path
# 从迁移后的测试包向上识别工程根，测试数据和输出必须继续归属当前工程。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 生产 Python core 的唯一位置与测试 source set 分离，测试统一通过该路径加载真实能力。
MAIN_CODE_ROOT = (
    PROJECT_ROOT
    / "apps/ai-desktop/ruleengine/python/local/core"
)


# 定位待测能力文件。
ABILITY_PATH = MAIN_CODE_ROOT / "abilities" / "rule_package_generator.py"
# 规则生成器测试资源统一归入当前工程 OPTION/temp。
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION" / "temp"


# 动态加载能力模块，保持测试不依赖 Python 包安装。
def load_ability_module():
    # 按能力文件创建模块规格。
    spec = importlib.util.spec_from_file_location("rule_package_generator_test_module", ABILITY_PATH)
    # 规格必须存在。
    assert spec is not None
    # 模块加载器必须存在。
    assert spec.loader is not None
    # 根据规格创建独立模块。
    module = importlib.util.module_from_spec(spec)
    # 执行能力文件完成模块加载。
    spec.loader.exec_module(module)
    # 返回待测模块。
    return module


# 验证标准目录规划、真实生成和旧模板参数阻断。
class RulePackageGeneratorTests(unittest.TestCase):

    # 每个 Case 创建独立规则资源根。
    def setUp(self) -> None:
        # 加载当前能力模块。
        self.module = load_ability_module()
        # 确保统一测试运行目录存在。
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        # 创建可自动清理的临时目录。
        self.temp_dir = tempfile.TemporaryDirectory(prefix="rule_package_", dir=OPTION_TEMP_ROOT)
        # 临时目录根模拟 rule-engine resources。
        self.resource_root = Path(self.temp_dir.name).resolve()
        # 创建 SELPLAT 通用作用域及其规则正文目录。
        self.scope_root = self.resource_root / "selplat" / "通用"
        # 创建完整 rule 目录，生成器不得猜测或新造项目分类。
        (self.scope_root / "rule").mkdir(parents=True)
        # 创建 SELPLAT 通用叶子索引，模拟生产分级索引结构。
        self.scope_index = self.scope_root / "RULE_INDEX.md"
        # 写入空测试索引供生成能力追加当前作用域规则。
        self.scope_index.write_text("# test scope index\n", encoding="utf-8")

    # 每个 Case 结束后清理临时规则资源。
    def tearDown(self) -> None:
        # 删除当前 Case 全部临时文件。
        self.temp_dir.cleanup()

    # 验证 plan 返回 rule 主文件和可选模板约定位置且不写文件。
    def test_plan_returns_rule_file_and_optional_template_location(self) -> None:
        # 请求只读计划。
        result = self.module.execute(self._context("plan"), {}, {})
        # 能力必须返回 planned。
        self.assertEqual("planned", result["status"])
        # 主规则文件固定位于通用/rule。
        self.assertEqual(
            self.scope_root / "rule" / "RUL_Java业务注释规则.md",
            Path(result["main_rule_path"]),
        )
        # 模板只返回约定位置，不代表应自动创建。
        self.assertEqual(
            self.scope_root / "template" / "RUL_Java业务注释规则",
            Path(result["template_root"]),
        )
        # plan 不得提前创建主规则。
        self.assertFalse(Path(result["main_rule_path"]).exists())
        # plan 不得提前创建模板目录。
        self.assertFalse(Path(result["template_root"]).exists())

    # 验证 generate 只创建规则正文和索引入口。
    def test_generate_creates_rule_and_index_without_synthetic_template(self) -> None:
        # 执行真实生成。
        result = self.module.execute(self._context("generate"), {}, {})
        # 能力必须明确返回 generated。
        self.assertEqual("generated", result["status"])
        # 主规则文件必须存在。
        self.assertTrue(Path(result["main_rule_path"]).is_file())
        # 未提供真实材料时不得创建 template 或 README。
        self.assertFalse(Path(result["template_root"]).exists())
        # 所属 SELPLAT 叶子索引必须直接指向 rule 下的主规则文件。
        self.assertIn(
            "SELPLAT_JAVA_COMMENT_RULES = selplat/通用/rule/RUL_Java业务注释规则.md",
            self.scope_index.read_text(encoding="utf-8"),
        )
        # 全局根索引没有参与测试，也证明生成器不再要求把作用域规则写入根入口。
        self.assertFalse((self.resource_root / "RULE_INDEX.md").exists())

    # 验证旧资产目录参数在生成前被阻断，防止重建废弃结构。
    def test_legacy_asset_directories_are_blocked(self) -> None:
        # 构造旧版自动模板目录参数。
        context = self._context("generate")
        # 即使目录名曾经合法，也不得再由程序自动创建。
        context["asset_directories"] = ["template"]
        # 执行能力。
        result = self.module.execute(context, {}, {})
        # 必须返回 blocked。
        self.assertEqual("blocked", result["status"])
        # 被阻断后不得创建主规则。
        self.assertFalse((self.scope_root / "rule" / "RUL_Java业务注释规则.md").exists())

    # 验证现有主规则文件不会被生成器覆盖。
    def test_existing_main_rule_is_blocked(self) -> None:
        # 预先创建人工维护的真实主规则。
        existing_rule = self.scope_root / "rule" / "RUL_Java业务注释规则.md"
        # 写入可识别原正文。
        existing_rule.write_text("# existing rule\n", encoding="utf-8")
        # 再次请求生成同名规则。
        result = self.module.execute(self._context("generate"), {}, {})
        # 必须返回现有规则阻断。
        self.assertEqual("blocked_existing_rule", result["status"])
        # 原主规则正文必须保持不变。
        self.assertEqual("# existing rule\n", existing_rule.read_text(encoding="utf-8"))
        # 被阻断后不得创建模板目录。
        self.assertFalse((self.scope_root / "template").exists())

    # 验证重复索引键会回滚新生成文件。
    def test_duplicate_index_key_is_blocked_and_generated_files_are_removed(self) -> None:
        # 在所属叶子索引中预先登记相同键。
        self.scope_index.write_text(
            "# test index\nSELPLAT_JAVA_COMMENT_RULES = existing.md\n",
            encoding="utf-8",
        )
        # 请求生成使用相同索引键的新规则。
        result = self.module.execute(self._context("generate"), {}, {})
        # 必须返回重复索引键阻断。
        self.assertEqual("blocked_existing_index_key", result["status"])
        # 回滚后主规则文件不得残留。
        self.assertFalse((self.scope_root / "rule" / "RUL_Java业务注释规则.md").exists())
        # 回滚后 template 根也不得被创建。
        self.assertFalse((self.scope_root / "template").exists())

    # 验证显式索引不能越出规则资源根。
    def test_explicit_index_path_escape_is_blocked(self) -> None:
        # 构造指向临时资源根外部的索引路径。
        context = self._context("generate")
        # `..` 规范化后离开资源根，必须在创建文件前阻断。
        context["index_path"] = "../outside/RULE_INDEX.md"
        # 执行能力并取得结构化阻断结果。
        result = self.module.execute(context, {}, {})
        # 路径越界必须返回 blocked。
        self.assertEqual("blocked", result["status"])
        # 被阻断后不得创建主规则。
        self.assertFalse((self.scope_root / "rule" / "RUL_Java业务注释规则.md").exists())

    # 构造当前测试统一能力上下文。
    def _context(self, action: str) -> dict:
        # 返回完整规则资源、范围、名称和索引事实。
        return {
            "action": action,
            "resource_root": str(self.resource_root),
            "scope_path": "selplat/通用",
            "rule_name": "RUL_Java业务注释规则",
            "index_key": "SELPLAT_JAVA_COMMENT_RULES",
            "rule_content": "# Java 业务注释规则\n",
        }


# 允许直接运行当前测试文件。
if __name__ == "__main__":
    # 启动 unittest。
    unittest.main()
