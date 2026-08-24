package com.sp.selplat.aifactory.aiworkflownode.service.impl;

import com.sp.selplat.aifactory.aiworkflownode.dao.AiWorkflowNodeDao;
import com.sp.selplat.aifactory.aiworkflownode.service.AiWorkflowNodeService;
import com.sp.selplat.common.service.BaseServiceImpl;
import org.springframework.stereotype.Service;

/** 由流程节点 DAO 提供标准单表业务能力。 */
@Service
public class AiWorkflowNodeServiceImpl extends BaseServiceImpl<AiWorkflowNodeDao>
        implements AiWorkflowNodeService { }
