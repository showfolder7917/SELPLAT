package com.sp.selplat.aifactory.aiworkflowversion.service.impl;

import com.sp.selplat.aifactory.aiworkflowversion.dao.AiWorkflowVersionDao;
import com.sp.selplat.aifactory.aiworkflowversion.service.AiWorkflowVersionService;
import com.sp.selplat.common.service.BaseServiceImpl;
import org.springframework.stereotype.Service;

/** 由流程版本 DAO 提供标准单表业务能力。 */
@Service
public class AiWorkflowVersionServiceImpl extends BaseServiceImpl<AiWorkflowVersionDao>
        implements AiWorkflowVersionService { }
