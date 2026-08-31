import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 当前脚本位于 apps/ai-desktop/scripts，向上一级就是唯一允许操作的应用根。
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 只清理本应用自动生成的 Electron 编译目录，源码、Renderer 构建和用户数据都不在范围内。
const electronBuildRoot = path.resolve(appRoot, "../../build/ai-desktop/electron/electron");
// 路径守卫防止未来移动脚本后误删工作区或其他应用产物。
const expectedParent = path.resolve(appRoot, "../../build/ai-desktop/electron");
if (path.dirname(electronBuildRoot) !== expectedParent || path.basename(electronBuildRoot) !== "electron") {
  throw new Error(`拒绝清理非 AI Desktop Electron 构建目录：${electronBuildRoot}`);
}

// 编译前删除旧 JavaScript，确保已迁移源码不会被历史输出继续加载。
rmSync(electronBuildRoot, { recursive: true, force: true });
process.stdout.write(`Cleaned generated Electron build: ${electronBuildRoot}\n`);
