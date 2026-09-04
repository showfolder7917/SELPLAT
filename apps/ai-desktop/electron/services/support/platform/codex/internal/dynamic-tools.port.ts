/** 与固定Codex运行时导出的dynamicTools协议一致，仅由组合根注入。 */
export interface CodexDynamicToolsPort {
  definitions: Array<{ type: "function"; name: string; description: string; inputSchema: Record<string, unknown> }>;
  call(name: string, argumentsValue: unknown): Promise<{ contentItems: Array<{ type: "inputText"; text: string } | { type: "inputImage"; imageUrl: string }>; success: boolean }>;
}
