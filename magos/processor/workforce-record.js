'use strict';
const crypto=require('node:crypto');
const {planWorkforceOnboarding}=require('./workforce-onboarding');

// Accept only independently verified opaque references from the trusted
// server-side authority adapter. Never put ID numbers or employee names
// into shared transaction plans, error messages or audit evidence.
function buildWorkforceRecordPlan({type,subjectRef,employerRef,sourceRef}={}){
 planWorkforceOnboarding({type});
 for(const value of [subjectRef,employerRef,sourceRef]){
  if(typeof value!=='string'||!/^opaque:[a-f0-9]{64}$/.test(value))throw Error('INVALID_OPAQUE_REFERENCE');
 }
 const digest=(domain,...parts)=>crypto.createHash('sha256').update([domain,...parts].join('|')).digest('hex');
 const employeeId='EMP-'+digest('workforce-employee-v1',employerRef,subjectRef);
 const eventId='HR-'+digest('workforce-event-v1',employerRef,sourceRef);
 const values={employee_id:employeeId,employment_path:type,onboarding_state:'REVIEW_REQUIRED'};
 return {event_type:'WORKFORCE_ONBOARDING_REVIEW_CREATED',source_event_id:eventId,
  idempotency_key:'workforce-onboarding:'+eventId, input_scope:'WORKFORCE_ONBOARDING',
  preconditions:[],writes:[{store:'workforce',workbook_role:'workforce',
   sheet:'Employees',entity_type:'Employee / employment relationship',authority:'AUTHORITATIVE',
   operation:'APPEND_IF_ABSENT',key:{header:'employee_id',value:employeeId},values}]};
}
async function prepareWorkforceRecord({request,verifyAuthority,writer}={}){
 if(typeof verifyAuthority!=='function'||!writer?.stores?.workforce||typeof writer.execute!=='function')
  return {state:'BLOCKED',reason:'RESTRICTED_AUTHORITY_NOT_CONFIGURED'};
 // Verifier is injected server-side, never accepted from the HTTP payload.
 const evidence=await verifyAuthority(request);
 if(evidence?.verified!==true||evidence?.approved!==true)
  return {state:'REVIEW_REQUIRED',reason:'INDEPENDENT_APPROVAL_REQUIRED'};
 const plan=buildWorkforceRecordPlan(evidence);
 const result=await writer.execute(plan);
 // Never expose shared audit rows, private evidence or raw writer errors.
 const state=['COMMITTED','DUPLICATE_NO_OP','RETRY_REQUIRED','FAILED'].includes(result?.state)?result.state:'FAILED';
 return {state,employee_id:plan.writes[0].key.value,operational_clearance:false};
}
module.exports={buildWorkforceRecordPlan,prepareWorkforceRecord};
