package com.sp.selplat.referencedata.referencedatatableelement.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import org.springframework.stereotype.Repository;

/** 把表格元素公共 CRUD 固定到 reference-data 私有数据库和全局对象号段。 */
@Repository
public class ReferenceDataTableElementDaoImpl extends ReferenceDataBaseDao implements ReferenceDataTableElementDao {
}
