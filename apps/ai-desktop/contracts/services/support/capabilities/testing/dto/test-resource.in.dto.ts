/** 测试任务申请排他资源时提交的数据。 */
export interface TestResourceInDto {
  runId: string;
  taskId: string | null;
  initiatorMemberId: string;
  kind: "task-validation" | "integration-validation" | "linghu-unified-test";
  port: number | null;
  buildRoot: string;
}
