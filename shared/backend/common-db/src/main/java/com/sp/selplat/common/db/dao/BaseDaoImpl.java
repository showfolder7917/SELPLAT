package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.domain.CommonEntity;

// 公共 DAO 基类直接桥接 BaseTemplateDao，让简单主数据模块只配置表信息就能复用通用 CRUD。
public abstract class BaseDaoImpl extends BaseDaoImplExtends {

    // 子类必须明确当前公共 DAO 的主键列名，供更新和删除按唯一标识命中目标记录。
    protected String getId() {
        // 公共基类默认沿用通用实体主键字段定义，让简单单表 DAO 不必重复声明同一主键名。
        CommonEntity ce = new CommonEntity();
        // 返回平台约定的默认主键字段，供模板更新、删除和详情查询统一定位目标记录。
        return ce.getKey();
    }

    // 子类必须明确当前列表和详情默认读取的列清单，避免模板层直接无约束执行 select *。
    protected abstract String getSelectColumns();
}
