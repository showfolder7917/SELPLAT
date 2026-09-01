const [moduleUrl, coordinationRoot, releaseBatchId, holdMilliseconds] = process.argv.slice(2);
const { IntegrationReleaseCoordinatorFacade } = await import(moduleUrl);
const events = [];
const coordinator = new IntegrationReleaseCoordinatorFacade({
  coordinationRoot,
  recordEvent: (type, details) => events.push({ type, ...details }),
  heartbeatIntervalMs: 10,
  staleHeartbeatMs: 1_000,
});
await coordinator.run({
  releaseBatchId,
  version: "0.1.1",
  generation: Number(releaseBatchId.slice(-1)),
  taskIds: [`TASK-${releaseBatchId}`],
  initiatorMemberId: "linghu-ancestor",
}, () => new Promise((resolve) => setTimeout(resolve, Number(holdMilliseconds))));
process.stdout.write(JSON.stringify(events));
