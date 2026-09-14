import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertDeveloperPackageInputCapacity } from "./developer-package-input.mjs";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(applicationRoot, "../..");
const capacity = assertDeveloperPackageInputCapacity({ applicationRoot, projectRoot });

console.log(
  `Developer package capacity preflight passed: ${capacity.availableBytes} bytes available for ${capacity.requiredBytes} bytes required.`,
);
