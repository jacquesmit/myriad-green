'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCanonicalJobAuthorityVerifier}=require('../processor/canonical-job-authority');
const stores={commercial:{
 findByKey:async()=>({object:{quote_id:'Q1',opportunity_id:'O1','Quote Status':'ACCEPTED'}}),
 readObjects:async sheet=>sheet==='Payment Control'?[{'Control ID':'P1','Opportunity ID':'O1','Deposit Required (R)':'400'}]:[{control_id:'P1',allocation_id:'A1',allocation_type:'DEPOSIT',allocation_state:'CLEARED',amount:'400',evidence_link:'drive://bank'}]
}};
const signature=async({quote_id,opportunity_id})=>({verified:true,quote_id,opportunity_id,evidence_ref:'drive://signed',signer_identity:'Verified signer',signed_at:'2026-10-11',source_event_id:'E1'});
test('release authority requires matching signed event plus canonical cleared allocation',async()=>{
 const verify=createCanonicalJobAuthorityVerifier({stores,acceptanceVerifier:signature});
 const result=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'});
 assert.equal(result.verified,true);assert.equal(result.payment_control_id,'P1');
});
test('different source event never authorizes release',async()=>{
 const verify=createCanonicalJobAuthorityVerifier({stores,acceptanceVerifier:signature});
 const result=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'OTHER'});
 assert.equal(result.verified,false);assert.equal(result.reason_code,'SIGNED_EVENT_ID_MISMATCH');
});
test('no independent signer cannot authorize release',async()=>{
 const verify=createCanonicalJobAuthorityVerifier({stores});
 const result=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'});
 assert.equal(result.verified,false);
});
