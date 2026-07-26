# 执行文档线程隔离规则

<!-- 问题：多个 Codex 任务页面共同使用固定执行文档文件时，未完成步骤、锁和历史记录会互相覆盖或阻塞。 -->
<!-- 场景：统一能力在任意工程的 OPTION 目录创建、续写、检查或归档执行文档。 -->
<!-- 业务含义：每个任务页面拥有可独立追踪、可独立归档的执行状态，不会影响另一个页面。 -->

<!-- 当前执行文档必须含当前 Codex 任务页面线程标识；适用于 execution_doc_manager 的当前任务状态文件；业务含义是同一工程的多个页面不会共享未完成步骤 -->
execution_document_must_use_current_thread_id = true

<!-- 当前线程文件名固定带线程标识；适用于当前任务的创建、检查和步骤回写；业务含义是文件名本身可表达记录所属页面 -->
execution_document_filename = 执行文档.<CURRENT_THREAD_ID>.md

<!-- 同日归档文件也必须带线程标识；适用于任务完成后的追加式归档；业务含义是不同页面的历史不会写入同一文件 -->
execution_history_filename = 执行文档.history_YYYY-MM-DD.<CURRENT_THREAD_ID>.md

<!-- 同一线程的锁文件必须带相同线程标识；适用于并发步骤完成时；业务含义是页面内保持串行一致、页面间不互相阻塞 -->
execution_document_lock_filename = 执行文档.<CURRENT_THREAD_ID>.lock

<!-- 线程标识优先由调用参数传入，未传时读取当前 Codex 页面环境；适用于桌面端与自动化调用；业务含义是自动运行和测试均可准确定位页面 -->
execution_document_thread_id_source = context.thread_id,then_CODEX_THREAD_ID

<!-- 旧无线程执行文档仅可在首个线程文档尚不存在时原子迁移一次；适用于能力升级兼容；业务含义是保留旧任务但禁止旧共享入口继续写入 -->
legacy_execution_document_must_migrate_once = true

<!-- 缺少桌面端线程上下文的本地调用必须使用独立 local 标识；适用于 CLI 和测试环境；业务含义是不得回退写入旧共享文件 -->
execution_document_non_codex_fallback_thread_id = local
