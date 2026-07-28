package com.sp.selplat.common.service;

import com.sp.selplat.common.db.dao.BaseDao;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 为业务 Service 统一装配强类型 {@link BaseDao} 门面。
 * 本层只持有 {@code getDao()}，默认 CRUD、发号和结果构建由扩展基础层承载。
 *
 * @param <D> 当前业务 Service 对应的 BaseDao 子接口，例如 {@code UniauthUserDao}
 */
public abstract class BaseServiceImpl<D extends BaseDao> extends BaseExtendsServiceImpl<D> implements BaseService {

    // 当前业务 DAO 由 Spring 按子类声明的泛型类型注入，避免每个 ServiceImpl 重复声明 DAO 字段和构造函数。
    @Autowired
    private D dao;

    /**
     * 返回当前业务 Service 绑定的强类型 DAO 门面。
     *
     * @return Spring 按泛型注入的 DAO 门面，例如 {@code UniauthUserDao} 代理
     */
    @Override
    protected D getDao() {
        // 统一返回 Spring 已按业务 Service 泛型注入的 DAO，子类只能通过 BaseDao 公开契约访问持久层。
        return dao;
    }
}
