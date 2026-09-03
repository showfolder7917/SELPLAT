# RUL_AIDesktop演化持久化与发布规则 升级历史

> 可丢失历史记录：本文件不是规则、索引、程序、测试或构建输入；当前有效约束只以正式规则正文为准。

<!-- 5.110.0 让 SQLite 成为专题演化运行态唯一事实源，并退役旧实时横幅与重复启动失败线路。 -->
upgrade_record_5_110 = 2026-08-30:新增AiDesktopEvolutionState单例状态表_版本8_JSON校验_SQLite唯一生产事实源_旧nangong_evolution_JSON不再读写迁移或回退_旧文件仅保留取证_首次状态从AiDesktopConversationMemory恢复可见会话_数据库不可用安全阻断_协作时间线取代EvolutionLiveActivity_真实运行返回当前阶段说明_无人执行的遗留running审计结束_业务冲突不再标记发送失败

<!-- 5.113.0 把南宫婉会话正文移出 Evolution JSON，改由统一人物会话表装配。 -->
upgrade_record_5_113 = 2026-09-03:Evolution_JSON只保存专题运行事实_南宫婉正文按ownerPersonaId从统一人物会话表读取_删除AiDesktopConversationMemory运行时恢复描述_数据库不可用继续安全阻断且不设第二存储
