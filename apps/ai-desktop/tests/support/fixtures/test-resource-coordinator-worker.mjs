const [moduleUrl, coordinationRoot, runId, buildRoot, holdMillisecondsText] = process.argv.slice(2);
const { TestResourceCoordinatorFacade } = await import(moduleUrl);
const events = [];
const coordinator = new TestResourceCoordinatorFacade({
  coordinationRoot,
  recordEvent: (type, details) => events.push({ type, ...details }),
  acquireTimeoutMs: 5_000,
  staleHeartbeatMs: 500,
  heartbeatIntervalMs: 50,
  pollIntervalMs: 10,
});
await coordinator.run({
  runId,
  taskId: runId,
  initiatorMemberId: "test-worker",
  kind: "task-validation",
  port: 4197,
  buildRoot,
}, () => new Promise((resolve) => setTimeout(resolve, Number(holdMillisecondsText))));
process.stdout.write(`${JSON.stringify(events)}\n`);
