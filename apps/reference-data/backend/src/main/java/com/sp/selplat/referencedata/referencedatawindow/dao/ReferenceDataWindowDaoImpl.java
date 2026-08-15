package com.sp.selplat.referencedata.referencedatawindow.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import org.springframework.stereotype.Repository;

/** 把 Window 配置公共 CRUD 固定到 reference-data 私有数据库和全局对象号段。 */
@Repository
public class ReferenceDataWindowDaoImpl extends ReferenceDataBaseDao implements ReferenceDataWindowDao {
}
