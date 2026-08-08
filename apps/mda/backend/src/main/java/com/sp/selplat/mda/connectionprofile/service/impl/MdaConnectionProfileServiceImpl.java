package com.sp.selplat.mda.connectionprofile.service.impl;

import com.sp.selplat.mda.common.service.MdaBaseServiceImpl;
import com.sp.selplat.mda.connectionprofile.dao.MdaConnectionProfileDao;
import com.sp.selplat.mda.connectionprofile.service.MdaConnectionProfileService;
import org.springframework.stereotype.Service;

/**
 * 连接配置 Service 只绑定 MDA 项目基础 Service 与连接配置 DAO。
 * 公共 CRUD、审计字段和事务边界由父类统一实现，目标数据库运行能力由 targetdatabase 模块承担。
 */
@Service
public class MdaConnectionProfileServiceImpl
        extends MdaBaseServiceImpl<MdaConnectionProfileDao>
        implements MdaConnectionProfileService {
}
