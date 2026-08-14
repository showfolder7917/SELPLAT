package com.sp.selplat.referencedata.referencedatacontrolbinding.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import org.springframework.stereotype.Repository;

/** 把 ReferenceDataControlBinding 公共 CRUD 固定到 reference-data 私有数据库。 */
@Repository
public class ReferenceDataControlBindingDaoImpl
        extends ReferenceDataBaseDao
        implements ReferenceDataControlBindingDao {
}

