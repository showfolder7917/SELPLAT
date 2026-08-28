# RUL_日本语题库AI媒体生成规则 升级历史

> 可丢失历史记录：本文件不是规则、索引、程序、测试或构建输入；当前有效约束只以正式规则正文为准。

<!-- 本次升级把 N2 查询和共享保存位置修正为平台默认修复基线。 -->
upgrade_record_20260816_default_query = 题号与题干独立查询_后台分页AND_编辑态保存紧跟重置

<!-- 本次升级让列表隐藏正确答案与图片、显示四个选项，并统一为一个可生成保存后播放的语音按钮。 -->
upgrade_record_20260816_question_grid_audio = 隐藏正确答案和图片_显示ABCD选项_统一播放语音按钮_缺失时生成保存并自动播放

<!-- 本次升级把练习状态从题目主表拆出，并固定一次页面请求、后端多表 Service 编排的边界。 -->
upgrade_record_20260817_learning_progress = 独立轮次表与逐题作答表_服务端用户身份_列表恢复当前轮选择_累计正确错误_查看解释_新一轮保留历史

<!-- 轮次标签与新一轮按钮按一个稳定复合根登记，避免内部元素分裂保存。 -->
upgrade_record_20260817_toolbar_page_editor = 轮次业务动作ControlLayout登记_复合根整体拖动调宽_共享保存跟随工具条末项

<!-- 本次升级修复首次答案被重复复用的问题，并固定零次数不显示图标。 -->
upgrade_record_20260817_answer_attempt = 每次选项点击实时判题并新增明细_同轮同题允许多次作答_每个选项始终显示单选圆圈_非零正确错误次数显示语义图标_零次数纯数字

<!-- 正确领先才显示绿色图标；错误领先或非零打平均显示红色图标。 -->
upgrade_record_20260817_count_dominance_icon = 正确较大仅正确显示绿色图标_错误较大或非零相等仅错误显示红色图标_零比零不显示图标_数字始终保留

<!-- 新一轮是会结束当前轮的业务动作，取消确认时不得请求后台。 -->
upgrade_record_20260817_next_round_confirmation = 点击新一轮先打开公共selConfirmDialog_取消保持当前轮且零请求_确认后才调用next-round并刷新_历史记录保留

<!-- 解释生成不得覆盖人工修订，长耗时必须在按钮本体直接反馈。 -->
upgrade_record_20260817_explanation_append_feedback = 生成按钮立即显示aria_busy与正在生成_返回解释以双换行追加到原解释末尾_禁止覆盖人工内容_超过8000字阻断_已有题目立即持久化_新增题目标准保存

<!-- 生成期间编辑区可能更新节点引用，完成时必须同时恢复原点击按钮和当前生成区按钮。 -->
upgrade_record_20260817_generation_button_reset = finally直接恢复activeButton_同步扫描当前generationView_成功失败均移除aria_busy与is_running_恢复默认文案_更新静态资源版本

<!-- 题目解释生成改为朗读文本单一输入的简体中文翻译，禁止题干回退和选项上下文泄漏。 -->
upgrade_record_20260817_audio_text_translation = 只读取audioText_空值直接拒绝_禁止questionText回退_禁止选项与正确答案进入提示词_只输出简体中文译文

<!-- 免费语音和翻译环境统一归档到 OPTION/plugin，翻译只允许外发已确认的朗读文本。 -->
upgrade_record_20260817_free_plugin_directory_and_translation = OPTION_plugin统一父目录_edge-tts与deep-translator独立venv_后端受控进程调用_Google提供方_仅audioText外发_Codex仅保留图片生成

<!-- 本次升级纠正“隐藏等于不传”的错误实现，双击编辑必须直接取得当前记录的真实答案和解释。 -->
upgrade_record_20260817_management_hidden_fields = 管理列表保留correctOption与explanation_正确答案表头登记但visible_false_双击复用当前记录_禁止默认A覆盖真实答案_禁止二次详情请求

<!-- 本次升级消除单选判题后的滚动条跳动，选择和次数通过公共 Grid 单行 API 原位写回。 -->
upgrade_record_20260817_answer_in_place_update = 判题成功只更新当前题目_单选状态与正确错误次数原位写回_selGrid_updateRecord_禁止japaneseRefresh整表重绘_保持滚动与焦点

<!-- 语音按钮只更新当前行忙碌状态；完整播放两遍并在中间停顿半秒。 -->
upgrade_record_20260817_audio_repeat_in_place = 播放按钮禁止setLocale与japaneseRefresh_当前行updateRecord_完整播放第一遍_停顿500毫秒_从头播放第二遍_不重建滚动容器

<!-- Codex exec 等非交互进程收到完整参数后必须立即收到 stdin EOF，禁止等待不存在的追加输入。 -->
upgrade_record_20260817_external_process_stdin_eof = ProcessBuilder启动后立即关闭getOutputStream_关闭失败强制终止子进程_再进入超时等待_回归探针验证EOF

<!-- 生成按钮执行时图标使用进度语义色和脉冲，结束或失败后由 is-running 移除恢复默认。 -->
upgrade_record_20260817_generation_icon_running_tone = is_running图标使用semantic_progress_执行中脉冲与光晕_finally移除is_running_恢复默认图标表面

<!-- 本规则来自用户对日语题库、直接生成和指定 edge-tts 环境的确认。 -->
upgrade_record = 2026-08-09:建立N2蓝宝书1000题题库_Codex图片解释_NanamiNeural语音_WebP和云存储预留规则;2026-08-09:修正Japanese页面未完整继承SEL主题运行时并手写树_表格_窗口_改用公共控件且保留紧凑字号;2026-08-09:增加扫描PDF题库的官方答案优先_OCR纠错_连续题号_排除范围_未决阻断和幂等导入门槛;2026-08-09:将未参与Japanese构建的Python导入器迁入当前用户rule-engine能力层并清理失败实验源码;2026-08-09:删除Japanese专用生成Request_全部复用CommonParam_CommonResult并接入全应用协议门禁;2026-08-10:删除无调用方Japanese表Domain_继续使用CommonParam_Map_数据库元数据CRUD;2026-08-10:重组Japanese为技术层优先_层内按题库业务分目录_生成媒体和外部进程统一进入common;2026-08-10:纠正为Uniauth式数据库业务目录优先_题库表相关代码聚合_common仅保存跨题库能力;2026-08-10:删除未启用的ReferenceDataProvider和独立reference-data装配_题型树暂由页面固定配置提供;2026-08-10:清理common伪Service和碎片目录_业务生成编排回归题库Service_Codex_语音_图片_媒体_进程拆分为分类共通工具;2026-08-10:删除仅有一个调用方的JapaneseCrudSupport_默认字段_有效查询_稳定排序和更新时间回归N2业务Service;2026-08-10:合并仅服务N2题库的ContentService_一个业务只保留一个Service接口和实现_生成编排直接调用分类共通工具;2026-08-10:增加不查PDF的Codex全题语义审校_锁定官方答案字母_唯一选项_完整朗读拼接_应用API同步门禁;2026-08-16:按平台默认修复基线接入三语国际化_引用数据自动登记_Grid表头_题型树_查询元素与Window页面编辑_无配置回退
