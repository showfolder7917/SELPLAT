// 发布包只加载自身已验证运行时，禁止兼容工程外部构建，避免源码或 build 损坏拖垮稳定程序。
await import("./main.js");
