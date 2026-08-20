package com.sp.selplat.aifactory.aiauditevent.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.Map;

/** 声明服务端自身可观察 API 事实的追加式审计能力。 */
public interface AiAuditEventDao extends BaseDao {
    /**
     * 追加一条哈希链审计事件。
     * 真实传参示例：action=HTTP_POST、targetId=/api/v1/ai-factory/tasks、status=SUCCESS。
     * 真实返回示例：影响一行并返回 {@code 1}。
     * 异常或副作用示例：写入失败抛数据库异常；不保存请求正文或令牌。
     * @param event 已脱敏的服务端可观察事实
     * @return 影响行数
     */
    int append(Map<String, Object> event);
}
