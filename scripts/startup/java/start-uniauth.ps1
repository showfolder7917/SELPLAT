[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# 当前平台根目录固定为 SELPLAT，直接使用绝对路径避免不同 PowerShell 宿主对脚本路径变量支持不一致。
$platformRoot = "C:\opt\workspace\SEL\SELPLAT"

# 明确指定 Java 21，保证运行阶段与编译阶段使用同一 JDK。
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.6.7-hotspot"
# 切到平台根目录后直接运行 uniauth backend，供本地最小 HTTP 验证使用。
Set-Location $platformRoot
& "C:\opt\workspace\SEL\SELPLAT\gradlew.bat" --offline :apps:uniauth:backend:run
