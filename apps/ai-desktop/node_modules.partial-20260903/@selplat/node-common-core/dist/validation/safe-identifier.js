import path from "node:path";
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
/** 校验工程名、任务 ID、测试 ID 和审批 ID，防止动态路径片段逃逸所属数据根。 */
export function validateSafeIdentifier(value, label = "identifier") {
    if (typeof value !== "string" || !SAFE_IDENTIFIER_PATTERN.test(value) || value.includes("..") || path.isAbsolute(value)) {
        throw new Error(`${label} must contain only letters, numbers, dashes, and underscores.`);
    }
    return value;
}
//# sourceMappingURL=safe-identifier.js.map