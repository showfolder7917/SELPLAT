import { execFileSync } from "node:child_process";

export function findDesktopAncestor(startPid, inspectProcess = inspectProcessByPid) {
  let pid = Number(startPid);
  for (let depth = 0; Number.isInteger(pid) && pid > 1 && depth < 24; depth += 1) {
    const processInfo = inspectProcess(pid);
    if (!processInfo) return null;
    if (processInfo.command.includes("AI Desktop.app/Contents/MacOS/AI Desktop")) return String(pid);
    pid = processInfo.parentPid;
  }
  return null;
}

export function inspectProcessByPid(pid) {
  try {
    const output = execFileSync("ps", ["-o", "ppid=,command=", "-p", String(pid)], { encoding: "utf8" }).trim();
    const match = /^(\d+)\s+(.+)$/u.exec(output);
    return match ? { parentPid: Number(match[1]), command: match[2] } : null;
  } catch {
    return null;
  }
}
