import path from "node:path";

import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

const appRoot = process.cwd();
const projectRoot = path.resolve(appRoot, "../..");
const applicationName = resolveApplicationNameFromSourceRoot(appRoot);
const paths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName });

// 受控命令输出公共路径能力解析的权威应用名和数据域，供测试登记、诊断与脚本调用复用。
process.stdout.write(`${JSON.stringify({ name: applicationName, ...paths }, null, 2)}\n`);
