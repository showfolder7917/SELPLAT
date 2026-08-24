package com.sp.selplat.aifactory.aiworkflowrun.service.impl;

import com.sp.selplat.aifactory.aiworkflowrun.dao.AiWorkflowRunDao;
import com.sp.selplat.aifactory.aiworkflowrun.service.AiWorkflowRunService;
import com.sp.selplat.common.service.BaseServiceImpl;
import org.springframework.stereotype.Service;

/** 由流程运行 DAO 提供标准单表业务能力。 */
@Service
public class AiWorkflowRunServiceImpl extends BaseServiceImpl<AiWorkflowRunDao>
        implements AiWorkflowRunService { }
