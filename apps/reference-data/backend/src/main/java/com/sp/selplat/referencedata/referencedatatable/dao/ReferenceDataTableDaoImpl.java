package com.sp.selplat.referencedata.referencedatatable.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import org.springframework.stereotype.Repository;

/** 把 ReferenceDataTable 公共 CRUD 固定到 reference-data 私有数据库。 */
@Repository
public class ReferenceDataTableDaoImpl extends ReferenceDataBaseDao implements ReferenceDataTableDao {
}
