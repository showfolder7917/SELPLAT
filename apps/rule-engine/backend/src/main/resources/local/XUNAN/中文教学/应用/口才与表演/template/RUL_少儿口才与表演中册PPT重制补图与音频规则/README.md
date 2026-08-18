# 少儿口才与表演中册生成配置

## 文件职责

- `课程内容索引.json`：保存第2至16课的页数、页序、课堂模块和原始教学文字。
- `缓存资源清单.json`：声明大体积插图、播放按钮和示例音频在当前工程缓存中的相对位置及恢复方式。

## 代码入口

- 生成、分析、音频嵌入和专项质检：`apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/oral_performance_ppt_tools.py`
- 横版通用质检：`apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/presentation_quality_inspector.py`

## 运行数据

- 大体积可复用素材：`cache/中文教学/口才与表演/中册`
- PPT成品与检测报告：`OPTION/temp`
- 所有路径均相对于当前工程根解析，配置和代码内部禁止写死用户绝对路径。
