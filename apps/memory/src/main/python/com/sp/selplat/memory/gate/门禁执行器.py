"""本地文件型 Gate Runner；服务端只接收本类产生的证据。"""

import hashlib
import json
from pathlib import Path

from com.sp.selplat.core.文件读取器 import FileReader

from ..model.接口模型 import GateEvidence


class GateRunner:
    def verify_task_ownership(self, task_root: Path, paths: list[Path]) -> GateEvidence:
        violations: list[str] = []
        root = task_root.resolve()
        reader = FileReader((root,))
        snapshots: list[dict[str, str]] = []
        for path in paths:
            resolved = path.resolve()
            if root not in resolved.parents:
                violations.append(f"OUT_OF_TASK_ROOT:{path}")
                continue
            # Gate 只计算原始字节摘要，但文件访问仍必须通过统一读取入口。
            digest = hashlib.sha256(reader.read_bytes(resolved)).hexdigest() if resolved.is_file() else "MISSING"
            snapshots.append({"path": str(resolved.relative_to(root)), "sha256": digest})
        result = "PASS" if not violations else "FAIL"
        canonical = json.dumps({"gateId": "GATE_TASK_ROOT", "result": result,
                                "violations": violations, "snapshots": snapshots},
                               ensure_ascii=False, sort_keys=True).encode("utf-8")
        return GateEvidence("GATE_TASK_ROOT", result, tuple(violations), hashlib.sha256(canonical).hexdigest())
