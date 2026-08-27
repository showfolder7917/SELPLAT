const expectedPlatform = process.argv[2];
if (expectedPlatform !== "win32" && expectedPlatform !== "darwin") {
  throw new Error(`不支持的打包宿主声明：${expectedPlatform || "未提供"}`);
}
// 原生桌面包只允许在同操作系统生成，避免宿主可选依赖、签名工具和真实启动验证与目标平台错配。
if (process.platform !== expectedPlatform) {
  const targetName = expectedPlatform === "win32" ? "Windows" : "macOS";
  throw new Error(`${targetName} 安装包必须在 ${targetName} 环境构建，当前宿主为 ${process.platform}。`);
}
