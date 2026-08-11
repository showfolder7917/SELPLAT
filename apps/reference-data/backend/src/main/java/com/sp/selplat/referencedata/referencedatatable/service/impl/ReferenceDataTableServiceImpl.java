package com.sp.selplat.referencedata.referencedatatable.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.referencedata.referencedatatable.dao.ReferenceDataTableDao;
import com.sp.selplat.referencedata.referencedatatable.service.ReferenceDataTableService;
import org.springframework.stereotype.Service;

/** 使用公共数据库服务维护项目页面中的表格登记记录。 */
@Service
public class ReferenceDataTableServiceImpl
        extends BaseServiceImpl<ReferenceDataTableDao>
        implements ReferenceDataTableService {
}
