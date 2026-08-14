package com.sp.selplat.referencedata.referencedatacontrolbinding.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.referencedata.referencedatacontrolbinding.dao.ReferenceDataControlBindingDao;
import com.sp.selplat.referencedata.referencedatacontrolbinding.service.ReferenceDataControlBindingService;
import org.springframework.stereotype.Service;

/** 使用公共数据库服务维护页面控件与引用数据类型的稳定绑定。 */
@Service
public class ReferenceDataControlBindingServiceImpl
        extends BaseServiceImpl<ReferenceDataControlBindingDao>
        implements ReferenceDataControlBindingService {
}
