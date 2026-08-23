# @selplat/node-common-core

SELPLAT 跨应用 Node.js/TypeScript 公共运行能力。公共 API 只通过 `package.json` 的 `exports` 暴露；应用禁止跨目录引用本包内部源码。

当前提供安全业务标识校验，以及应用源码、缓存、构建、临时控制面和长期归档路径解析。编译输出固定进入工程根 `build/shared/node/common-core`。
