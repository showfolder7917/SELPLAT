# Japanese 日语题库

首期承载 N2《蓝宝书1000题》，页面地址为 `/japanese/japanese.html`。左侧按题型展示树，右侧显示题目表格；双击题目进入编辑窗口，可选择正确答案并直接翻译朗读文本、生成图片或语音。

## 当前题型与数据

- 首表：`JapaneseN2BlueBookQuestion`，预留 `PRONUNCIATION`、`KANJI`、`GRAMMAR` 三种题型。
- N1 后续使用独立题表，避免不同等级的数据和约束互相影响。
- 默认字段包括 `id`、`tenantId`、`lastOperateUserId`、`name`、`sortnum`、`status`、`createdAt`、`updatedAt`。
- 数据库脚本位于 `db/sql`，按 `load-order.txt` 的显式顺序加载；默认不灌入业务题目。活跃 `db/japanese.mv.db` 只在本地持久化且不提交 Git。

## AI 与媒体生成

- 朗读文本翻译调用 `OPTION/plugin/deep-translator-venv/bin/deep-translator` 的 Google 提供方，只外发 `audioText`；可通过 `JAPANESE_DEEP_TRANSLATOR_EXECUTABLE` 覆盖路径。
- 图片由程序调用本机 Codex CLI；默认使用 Codex 桌面应用内置可执行文件，也可通过 `JAPANESE_CODEX_EXECUTABLE` 覆盖。
- 语音固定默认调用 `OPTION/plugin/edge-tts-venv/bin/edge-tts`，音色为 `ja-JP-NanamiNeural`；可通过 `JAPANESE_EDGE_TTS_EXECUTABLE` 覆盖路径。
- 图片先生成原图，再由 FFmpeg 压缩成质量 82 的 WebP，保存到 `backend/src/main/resources/static/pic`。
- 语音保存为 MP3，目录为 `backend/src/main/resources/static/audio`。
- 题表只保存 `storageProvider`、`storageKey` 和访问 URL，不保存机器绝对路径。`JapaneseMediaStorage` 是存储边界，未来替换成对象存储时不需要改变题库业务接口。
- 三个生成按钮不弹二次确认；生成失败时不会修改题目记录。

## 验证边界

自动化测试使用假的外部进程验证 deep-translator、Codex、FFmpeg 和 edge-tts 编排，不实际调用在线翻译、模型或语音服务。真实启动验证只检查页面、CRUD、引用数据树和静态资源路由。
