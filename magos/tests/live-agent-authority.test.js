'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LiveAgentAuthority}=require('../agents/live-agent-authority');
function reader(rows,agents,jobTypes=[['Job_Type_ID','','','','','','Primary_Agent_ID'],['JT-002','','','','','','AG-003']]){
 return new LiveAgentAuthority({sheets:{spreadsheets:{values:{
  batchGet:async()=>({data:{valueRanges:[{values:rows},{values:agents},{values:jobTypes}]}})
 }}}});
}
const header=['Job_Type_ID','Primary_Agent_ID','Support_Agent_IDs',
  'Handoff_From','Handoff_To','May_Read','May_Write','May_Change_State',
  'Human_Approval_Required','Escalation_Agent_ID','Notes'];
const registry=[['Agent_ID','Agent_Name'],['AG-003','CRM & Lead Agent']];
const good=[header,['JT-002','AG-003','AG-002,AG-011','','','','','','CONDITIONAL','','Routing is by Job_Type_ID']];
test('live ownership reconciles with snapshot without granting permission',async()=>{
 const result=await reader(good,registry).inspect('JT-002');
 assert.equal(result.verified,true);
 assert.equal(result.owner_agent_id,'AG-003');
 assert.equal(result.snapshot_matches_current,true);
 assert.equal(result.permissions_verified,false);
 assert.equal(result.source_freshness_verified,false);
});
test('missing or duplicate ownership is denied',async()=>{
 assert.equal((await reader([header],registry).inspect('JT-002')).reason,
  'OWNER_MISSING_OR_DUPLICATED');
 assert.equal((await reader([...good,good[1]],registry).inspect('JT-002')).reason,
  'OWNER_MISSING_OR_DUPLICATED');
});
test('changed owner produces nonmatching snapshot',async()=>{
 const changed=[header,['JT-002','AG-004','AG-002,AG-011','','','','','','CONDITIONAL','','']];
 const x=await reader(changed,[['Agent_ID'],['AG-004']], [['Job_Type_ID','','','','','','Primary_Agent_ID'],['JT-002','','','','','','AG-004']]).inspect('JT-002');
 assert.equal(x.verified,true);
 assert.equal(x.snapshot_matches_current,false);
});
test('missing registered agent fails closed',async()=>{
 assert.equal((await reader(good,[['Agent_ID']]).inspect('JT-002')).reason,
  'AGENT_MISSING_OR_DUPLICATED');
});
test('invalid schema and provider outage fail closed',async()=>{
 const invalid=await reader([['BadHeader']],registry).inspect('JT-002');
 assert.equal(invalid.reason,'CANONICAL_SCHEMA_MISMATCH');
 const fail=new LiveAgentAuthority({sheets:{spreadsheets:{values:{
  batchGet:async()=>{throw Error('network');}
 }}}});
 assert.equal((await fail.inspect('JT-002')).reason,'CANONICAL_READ_FAILED');
});
test('no free-text job types',async()=>{
 assert.equal((await reader(good,registry).inspect('do something')).reason,'INVALID_JOB_TYPE');
});

test('conflicting Job Types tab owner is rejected',async()=>{
 const wrong=[['Job_Type_ID','','','','','','Primary_Agent_ID'],['JT-002','','','','','','AG-010']];
 const result=await reader(good,registry,wrong).inspect('JT-002');
 assert.equal(result.reason,'JOB_TYPE_OWNER_CONFLICT');
});
