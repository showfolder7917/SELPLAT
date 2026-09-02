本任务已经修改的文件：
{{files}}

确认当前 runId 的测试文档已登记 npm run typecheck 与 npm run test:interaction，然后只通过固定命令 npm run test:document 取得独占锁并统一执行；命令不得追加 executor、task、thread 或其他动态参数。运行器会把完整批次原子移入运行中目录，完成后立即按年月和 runId 归档。占用时必须报告锁中的执行者、任务、线程和当前项。test:interaction 会在后台启动隔离 Electron，通过 Playwright 定位器执行真实程序化交互。禁止正式构建、启动或重启当前应用；失败时创建新 runId 的待执行测试批次再修复复测，最多 {{maximumRounds}} 轮。
