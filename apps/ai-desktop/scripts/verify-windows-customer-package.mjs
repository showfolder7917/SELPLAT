/** 检查 Windows 客户目录包的真实资源边界，不以 Builder 配置文本代替产物检查。 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.resolve(appRoot, "../../build/ai-desktop/package/customer/win-unpacked");
const resourcesRoot = path.join(packageRoot, "resources");
const asarPath = path.join(resourcesRoot, "app.asar");
if (!existsSync(asarPath)) throw new Error(`Windows customer app.asar is unavailable: ${asarPath}`);
for (const fileName of ["manifest.json", "rules.json"]) {
  const filePath = path.join(resourcesRoot, "ruleengine", fileName);
  if (!existsSync(filePath)) throw new Error(`Customer rule resource is missing: ${filePath}`);
  JSON.parse(readFileSync(filePath, "utf8"));
}

const listing = execFileSync(process.execPath, [require.resolve("@electron/asar/bin/asar.js"), "list", asarPath], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const entries = listing.split("\n").filter(Boolean);
for (const required of ["/dist/developer/index.html", "/dist-electron/electron/packaged-bootstrap.js", "/package.json"]) {
  if (!entries.includes(required)) throw new Error(`Customer runtime entry is missing: ${required}`);
}
const forbidden = entries.filter((entry) =>
  /^\/(?:ruleengine|rule-engine|OPTION|archive|tests?|scripts)(?:\/|$)|\.(?:java|class|jar|py|pyc)$/.test(entry)
);
if (forbidden.length > 0) throw new Error(`Forbidden development content entered customer app.asar:\n${forbidden.slice(0, 30).join("\n")}`);

const packagedManifest = JSON.parse(execFileSync(process.execPath, [require.resolve("@electron/asar/bin/asar.js"), "extract-file", asarPath, "package.json"], { encoding: "utf8" }));
if (Object.hasOwn(packagedManifest, "selplatDevelopmentRoot")) throw new Error("Customer package leaked selplatDevelopmentRoot metadata.");
console.log(`Windows customer package verified: ${entries.length} asar entries and external production rule bundle.`);
