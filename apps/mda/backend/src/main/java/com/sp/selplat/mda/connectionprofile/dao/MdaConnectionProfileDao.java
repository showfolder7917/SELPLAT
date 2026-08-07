package com.sp.selplat.mda.connectionprofile.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.util.CommonParam;

/**
 * 声明 MDA 独立控制库中的连接配置持久化动作。
 * 本接口不继承平台主数据源 DAO，避免统一宿主把连接配置写入其他应用数据库。
 */
public interface MdaConnectionProfileDao extends BaseDao {

    /**
     * 使用控制库自增主键新增连接配置并返回数据库生成的 id。
     *
     * @param saveIn 已完成业务校验的连接字段，例如 {@code {"connectionName":"开发库","databaseType":"H2"}}
     * @return 数据库生成的主键，例如 {@code 10002}
     */
    long insertReturningId(CommonParam saveIn);
}
