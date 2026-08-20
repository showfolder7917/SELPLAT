-- 默认顺序为需求分析师、软件工程师、测试工程师；用户仍可在画布调整和重复拖入角色。
INSERT INTO AiWorkflowEdge(id,workflowVersionId,sourceNodeId,targetNodeId,edgeType,sortnum) SELECT 180001,160000,170001,170002,'SEQUENCE',10 WHERE NOT EXISTS(SELECT 1 FROM AiWorkflowEdge WHERE workflowVersionId=160000 AND sourceNodeId=170001 AND targetNodeId=170002);
INSERT INTO AiWorkflowEdge(id,workflowVersionId,sourceNodeId,targetNodeId,edgeType,sortnum) SELECT 180002,160000,170002,170003,'SEQUENCE',20 WHERE NOT EXISTS(SELECT 1 FROM AiWorkflowEdge WHERE workflowVersionId=160000 AND sourceNodeId=170002 AND targetNodeId=170003);
