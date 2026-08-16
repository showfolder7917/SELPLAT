package com.sp.selplat.referencedata.referencedatacontrollayout.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import org.springframework.stereotype.Repository;

/** 把页面控件布局公共 CRUD 固定到 reference-data 私有数据库和本表独立主键号段。 */
@Repository
public class ReferenceDataControlLayoutDaoImpl extends ReferenceDataBaseDao implements ReferenceDataControlLayoutDao {
}
