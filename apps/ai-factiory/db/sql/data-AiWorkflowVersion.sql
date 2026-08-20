-- 默认流程从草稿版本开始，发布动作由管理页显式执行。
INSERT INTO AiWorkflowVersion(id,workflowId,versionNo,status,sortnum)
SELECT 160000,150000,1,'DRAFT',10
WHERE NOT EXISTS(SELECT 1 FROM AiWorkflowVersion WHERE workflowId=150000 AND versionNo=1);
