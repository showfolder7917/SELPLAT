# 少儿口才与表演中册生成配置

## 文件职责

- `课程内容索引.json`：保存第2至16课的页数、页序、课堂模块和原始教学文字。
- `缓存资源清单.json`：声明大体积插图、播放按钮和示例音频在当前工程缓存中的相对位置及恢复方式。

## 代码入口

- 生成器：`apps/rule-engine/backend/src/main/node/com/sp/selplat/local/code/common/中文教学/教学图片与PPT生成/口才与表演/中册/口才与表演中册PPT生成器.mjs`
- 音频嵌入器：`apps/rule-engine/backend/src/main/node/com/sp/selplat/local/code/common/中文教学/教学图片与PPT生成/口才与表演/中册/口才与表演中册音频嵌入器.mjs`
- 质量检测器：`apps/rule-engine/backend/src/main/node/com/sp/selplat/local/code/common/中文教学/教学图片与PPT生成/口才与表演/中册/口才与表演中册质量检测器.mjs`

## 运行数据

- 大体积可复用素材：`cache/中文教学/口才与表演/中册`
- PPT成品与检测报告：`OPTION/temp`
- 所有路径均相对于当前工程根解析，配置和代码内部禁止写死用户绝对路径。
