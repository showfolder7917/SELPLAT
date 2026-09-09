import { useEffect, useState } from "react";

import type { AiMemoryDatabaseStatusOutDto, AuditLogInfoOutDto, LocaleValue, TempDirectoryInfoOutDto, TrustedCommandInfoOutDto } from "../../../../contracts/system/desktop/index";
import { getOptionalCodexDesktopApi } from "../../../foundation/desktop-api";
import { getOptionalSystemDesktopApi } from "../../../foundation/desktop-api";

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 设置诊断 Feature 统一拥有数据库、审计、可信命令、临时文件与测试数据清理状态。 */
export function useDesktopDiagnostics(settingsOpen: boolean, locale: LocaleValue) {
  const [tempInfo, setTempInfo] = useState<TempDirectoryInfoOutDto | null>(null);
  const [auditInfo, setAuditInfo] = useState<AuditLogInfoOutDto | null>(null);
  const [trustedCommandInfo, setTrustedCommandInfo] = useState<TrustedCommandInfoOutDto>({ count: 0 });
  const [aiMemoryDatabaseStatus, setAiMemoryDatabaseStatus] = useState<AiMemoryDatabaseStatusOutDto | null>(null);
  const [testDataResetting, setTestDataResetting] = useState(false);
  const [testDataResetError, setTestDataResetError] = useState("");

  useEffect(() => {
    const desktop = getOptionalSystemDesktopApi();
    if (!desktop) return;
    void desktop.getAiMemoryDatabaseStatus().then(setAiMemoryDatabaseStatus);
    void desktop.getAuditLogInfo().then(setAuditInfo);
    void getOptionalCodexDesktopApi()?.getTrustedCommandInfo().then(setTrustedCommandInfo);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    refreshTempInfo();
    refreshAuditInfo();
    refreshTrustedCommandInfo();
  }, [settingsOpen]);

  const clearTempFiles = async () => {
    const info = await getOptionalSystemDesktopApi()?.clearTempFiles();
    if (info) setTempInfo(info);
  };
  const clearTrustedCommands = async () => {
    const info = await getOptionalCodexDesktopApi()?.clearTrustedCommands();
    if (info) setTrustedCommandInfo(info);
  };
  const clearTestData = async () => {
    setTestDataResetting(true);
    setTestDataResetError("");
    try {
      await getOptionalSystemDesktopApi()?.clearTestData();
    } catch (error) {
      setTestDataResetError(readableDesktopError(error, locale === "ja" ? "テストデータを消去できませんでした。" : "清空测试数据失败。"));
      setTestDataResetting(false);
    }
  };
  const refreshTempInfo = () => { void getOptionalSystemDesktopApi()?.getTempDirectoryInfo().then(setTempInfo); };
  const refreshAuditInfo = () => { void getOptionalSystemDesktopApi()?.getAuditLogInfo().then(setAuditInfo); };
  const refreshTrustedCommandInfo = () => { void getOptionalCodexDesktopApi()?.getTrustedCommandInfo().then(setTrustedCommandInfo); };

  return {
    tempInfo, auditInfo, trustedCommandInfo, aiMemoryDatabaseStatus, testDataResetting, testDataResetError,
    clearTempFiles, clearTrustedCommands, clearTestData, refreshTempInfo, refreshAuditInfo, refreshTrustedCommandInfo,
  };
}
