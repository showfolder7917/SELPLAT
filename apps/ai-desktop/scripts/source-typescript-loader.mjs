import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const electronSourceCheckShim = `
const noop = new Proxy(function () {}, { get: () => noop, apply: () => undefined, construct: () => noop });
export const app = { getPath: () => process.cwd(), getAppPath: () => process.cwd(), getVersion: () => "source-check", isPackaged: false, setPath: noop, requestSingleInstanceLock: () => true, quit: noop, on: noop, once: noop, whenReady: async () => undefined, relaunch: noop, exit: noop }; export const BrowserWindow = noop; export const contextBridge = noop;
export const desktopCapturer = noop; export const dialog = noop; export const ipcMain = noop;
export const ipcRenderer = noop; export const nativeImage = noop; export const screen = noop;
export const shell = noop; export const systemPreferences = noop;
export default noop;`;

/** 仅供源码直载检查使用：将编译产物的相对 .js 引用解析到同名 TypeScript 源文件。 */
export async function resolve(specifier, context, nextResolve) {
  // Node 直载只验证模块可链接；Electron 实例由正式运行时提供，不能在检查中启动。
  if (specifier === "electron") return { url: `data:text/javascript,${encodeURIComponent(electronSourceCheckShim)}`, shortCircuit: true };
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".") || !context.parentURL) throw error;
    const sourceExtension = specifier.endsWith(".cjs") ? ".cts" : specifier.endsWith(".js") ? ".ts" : null;
    if (!sourceExtension) throw error;
    const compiledExtension = specifier.endsWith(".cjs") ? ".cjs" : ".js";
    const sourceUrl = new URL(`${specifier.slice(0, -compiledExtension.length)}${sourceExtension}`, context.parentURL);
    try { await access(fileURLToPath(sourceUrl)); }
    catch { throw error; }
    return { url: sourceExtension === ".cts" ? `${sourceUrl.href}?source-check-ts` : sourceUrl.href, shortCircuit: true };
  }
}

/** 源码检查在内存中转译参数属性等 strip-only 不支持的 TypeScript 语法。 */
export async function load(url, context, nextLoad) {
  const sourceUrl = url.replace(/\?source-check-ts$/, "");
  if (!sourceUrl.endsWith(".ts") && !sourceUrl.endsWith(".cts")) return nextLoad(url, context);
  const source = await readFile(fileURLToPath(sourceUrl), "utf8");
  return {
    format: "module",
    source: ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      // .cts 在正式编译中输出 CommonJS；源码检查统一以 ESM 链接，避免 Node 将它当作无具名导出的 CJS。
      fileName: fileURLToPath(sourceUrl).replace(/\.cts$/, ".ts"),
    }).outputText,
    shortCircuit: true,
  };
}
