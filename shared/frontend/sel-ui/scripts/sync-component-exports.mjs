import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptRoot, "..");
const registryPath = path.join(packageRoot, "src/components/component-registry.json");
const packagePath = path.join(packageRoot, "package.json");

/** 把 selGridMenu 这类登记 ID 转成稳定的 grid-menu 正式子路径。 */
export function componentExportName(componentId) {
  return String(componentId)
    .replace(/^sel/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

/** 根据中央登记生成全部控件的脚本与样式出口，避免新增控件后人工漏接。 */
export function buildComponentExports(registry) {
  const exportsMap = {};
  for (const component of registry.components || []) {
    const exportName = componentExportName(component.id);
    component.scripts.forEach((sourceName, index) => {
      const suffix = index === 0 ? "" : `/${path.basename(sourceName, ".js")}`;
      exportsMap[`./components/${exportName}${suffix}`] = {
        types: "./src/runtime.d.ts",
        default: `./src/components/${component.directory}/${sourceName}`,
      };
    });
    component.styles.forEach((sourceName, index) => {
      const suffix = index === 0 ? "/styles" : `/styles/${path.basename(sourceName, ".css")}`;
      exportsMap[`./components/${exportName}${suffix}`] = {
        types: "./src/theme/css.d.ts",
        default: `./src/components/${component.directory}/${sourceName}`,
      };
    });
  }
  return Object.fromEntries(Object.entries(exportsMap).sort(([left], [right]) => left.localeCompare(right)));
}

/** 保留内核和主题出口，只替换由控件登记表拥有的 components 子路径。 */
export function synchronizePackageManifest(packageManifest, registry) {
  const stableExports = Object.fromEntries(
    Object.entries(packageManifest.exports || {}).filter(([exportPath]) => !exportPath.startsWith("./components/")),
  );
  return {
    ...packageManifest,
    exports: { ...stableExports, ...buildComponentExports(registry) },
  };
}

async function run() {
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const packageManifest = JSON.parse(await readFile(packagePath, "utf8"));
  const synchronized = synchronizePackageManifest(packageManifest, registry);
  const expected = `${JSON.stringify(synchronized, null, 2)}\n`;
  const current = await readFile(packagePath, "utf8");
  if (process.argv.includes("--check")) {
    if (current !== expected) {
      throw new Error("SELUI 控件正式出口与 component-registry.json 不一致，请运行 npm run sync:component-exports。");
    }
    return;
  }
  if (current !== expected) await writeFile(packagePath, expected, "utf8");
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
