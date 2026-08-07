package com.sp.selplat.mda.connection.dao;

import java.util.List;
import java.util.Map;

/**
 * 声明 MDA 独立控制库中的连接配置持久化动作。
 * 本接口不继承平台主数据源 DAO，避免统一宿主把连接配置写入其他应用数据库。
 */
public interface MdaConnectionProfileDao {

    List<Map<String, Object>> findAll();

    Map<String, Object> findById(long id);

    long insert(Map<String, Object> values);

    int update(long id, Map<String, Object> values);

    int softDelete(long id);
}
