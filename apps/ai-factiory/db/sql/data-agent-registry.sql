INSERT INTO ai_role_version(role_id,version,display_name,definition_logical_path,digest,permissions_json,status)
SELECT 'IMPLEMENTATION_ROLE','1.0.0','实现工程师','智能体/AGENT_实现工程师.md','seed-implementation-role-v1','["workspace:write","gate:request","audit:append"]','APPROVED'
WHERE NOT EXISTS (SELECT 1 FROM ai_role_version WHERE role_id='IMPLEMENTATION_ROLE' AND version='1.0.0');

INSERT INTO ai_agent_registration(agent_id,version,display_name,endpoint_type,endpoint,protocol_version,capabilities_json,config_digest,status)
SELECT 'IMPLEMENTATION_AGENT','1.0.0','实现工程师 Agent','LOCAL_CODEX','codex://agents/implementation','1.0','["code","test-registration","local-gate"]','seed-implementation-agent-v1','ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM ai_agent_registration WHERE agent_id='IMPLEMENTATION_AGENT' AND version='1.0.0');

INSERT INTO ai_role_agent_binding(role_version_id,agent_registration_id,priority,status,effective_from)
SELECT r.id,a.id,1,'ACTIVE',CURRENT_TIMESTAMP FROM ai_role_version r,ai_agent_registration a
WHERE r.role_id='IMPLEMENTATION_ROLE' AND r.version='1.0.0'
  AND a.agent_id='IMPLEMENTATION_AGENT' AND a.version='1.0.0'
  AND NOT EXISTS (SELECT 1 FROM ai_role_agent_binding b WHERE b.role_version_id=r.id AND b.agent_registration_id=a.id AND b.status='ACTIVE');

