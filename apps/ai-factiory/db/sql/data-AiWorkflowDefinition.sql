-- SELPLAT 默认流程只创建缺失定义，不覆盖页面后续维护内容。
INSERT INTO AiWorkflowDefinition(id,projectId,workflowCode,workflowName,description,status,sortnum)
SELECT 150000,130001,'SELPLAT_DEFAULT','SELPLAT默认开发流程','由本地Python按画布拓扑驱动',1,10
WHERE NOT EXISTS(SELECT 1 FROM AiWorkflowDefinition WHERE workflowCode='SELPLAT_DEFAULT');
