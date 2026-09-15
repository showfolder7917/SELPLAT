/**
 * 判断失败命令是否只用于读取现场；
 * 真实传参示例：`/bin/zsh -lc 'ls -l missing-file 2>&1'` 返回 true；
 * 返回示例：true 表示保留活动证据但不作为验证失败；
 * 异常示例：`npm run test`、`tsc --noEmit` 和任何含命令串联的命令始终返回 false。
 */
export function isReadOnlyInspectionCommand(command: string): boolean {
  const body = shellBody(command).replace(/\s+2>&1\s*$/, "");
  if (/[;&|`$()<>]/.test(body)) return false;
  if (/\b(?:npm|pnpm|yarn|tsc|vite|gradle|cargo|pytest|jest|vitest|playwright)\b/i.test(body)) return false;
  if (/^electron(?:\s|$)/i.test(body.trim())) return false;
  return /^(?:ls|rg|sed|cat|find|stat|test)\b/.test(body.trim());
}

function shellBody(command: string): string {
  const normalized = command.trim();
  const shell = normalized.match(/^\/bin\/(?:zsh|bash)\s+-lc\s+(['"])([\s\S]*)\1$/i);
  return shell ? shell[2] : normalized;
}
