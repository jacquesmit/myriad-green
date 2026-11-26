'use strict';

// Deterministic draft planning only. No personnel identifiers, provider calls or writes.
const gates=Object.freeze([
 ['identity','Verify identity and lawful right to work'],
 ['terms','Confirm actual commencement, duties, ordinary hours and remuneration'],
 ['contract','Prepare, approve and sign employment agreement'],
 ['uif','Verify UIF coverage, registration and declarations'],
 ['coida','Verify Compensation Fund registration and classification'],
 ['tax','Assess employer tax and sector-specific obligations'],
 ['payroll','Validate payroll rules and opening balances'],
 ['safety','Verify induction, PPE and job competency'],
 ['storage','Verify restricted storage and evidence permissions']
]);
const allowed=new Set(['new','existing','executive']);
function planWorkforceOnboarding({type}={}) {
 if(!allowed.has(type))throw new TypeError('INVALID_EMPLOYMENT_PATH');
 const steps=gates.map(([id,label])=>({id,label,state:'TO_CONFIRM'}));
 if(type==='existing')steps.splice(2,0,{id:'history',label:'Reconcile historical pay, leave and original service dates',state:'TO_CONFIRM'});
 if(type==='executive')steps.splice(2,0,{id:'authority',label:'Verify corporate approval and signing authority',state:'TO_CONFIRM'});
 return {schema_version:'MAGOS_WORKFORCE_DRAFT_V1',type,state:'REVIEW_REQUIRED',steps,
  optional_benefits:'DISABLED',employee_created:false,side_effects:false,production_complete:false,
  next_action:'Complete identity and employment evidence review'};
}
module.exports={planWorkforceOnboarding};
