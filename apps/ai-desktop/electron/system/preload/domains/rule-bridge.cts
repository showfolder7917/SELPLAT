/** 规则桥接只提供读取能力；客户覆盖文件由部署方写入用户数据目录，Renderer 无写入入口。 */
import { invoke } from "../ipc-client.cjs";

export function ruleBridge() {
  return {
    getRuleBundleStatus: () => invoke("desktop:get-rule-bundle-status"),
    listEffectiveRules: () => invoke("desktop:list-effective-rules"),
    resolveEffectiveRule: (logicalId: string) => invoke("desktop:resolve-effective-rule", logicalId),
  };
}
