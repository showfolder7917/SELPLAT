import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(appRoot, "../..");
const gradleLauncher = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const gradleUserHome = path.join(projectRoot, "cache", "gradle-user-home");

// 从真实工程根执行公共 SEL UI 源码边界门禁；例如 macOS 调用 ./gradlew，成功返回 0，失败原样返回 Gradle 状态码。
const result = spawnSync(gradleLauncher, [":shared:frontend:sel-ui:verifySelUiSourceBoundary", "--offline"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, GRADLE_USER_HOME: gradleUserHome, SELPLAT_PYTHON: process.env.SELPLAT_PYTHON || "python3" },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
