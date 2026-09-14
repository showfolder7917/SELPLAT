import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDeveloperPackageInputCapacity,
  formatDeveloperPackageCapacityBlocked,
} from "./developer-package-input.mjs";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(applicationRoot, "../..");
let capacity;
try {
  capacity = assertDeveloperPackageInputCapacity({ applicationRoot, projectRoot });
} catch (error) {
  // 容量预检的字段必须先写为固定记录，统一测试才能把等待授权与普通脚本失败区分开。
  if (error?.code === "ENOSPC" && error.capacity) console.error(formatDeveloperPackageCapacityBlocked(error.capacity));
  throw error;
}

console.log(
  `Developer package capacity preflight passed: ${capacity.availableBytes} bytes available for ${capacity.requiredBytes} bytes required.`,
);
