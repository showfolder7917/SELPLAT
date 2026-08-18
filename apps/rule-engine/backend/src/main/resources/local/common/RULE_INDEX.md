# common 预留规则索引

<!-- common 层当前不保存实际规则，只保留未来人工提升的稳定入口。 -->
common_index_scope = local/common

<!-- reserved_empty 表示加载器必须跳过 common 子树并继续加载当前用户层。 -->
common_index_status = reserved_empty

<!-- common 恢复写入前必须经过独立人工审查和明确授权。 -->
common_index_promotion_gate = manual_review_and_explicit_authorization
