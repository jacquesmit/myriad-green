'use strict';

// Derive aftercare candidates from installed assets and actual job records.
// Contact permission and maintenance policy must be independently verified.
// Warranty coverage is ONLY the parts actually replaced/installed by Myriad Green.
const value=v=>String(v??'').trim();
const upper=v=>value(v).toUpperCase();
const dateOnly=v=>{
 const s=value(v);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const date=new Date(s+'T00:00:00.000Z');
 return Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==s?null:s;
};
const addMonths=(date,months)=>{
 const [y,m,d]=date.split('-').map(Number);
 const zeroMonth=y*12+m-1+months;
 const destYear=Math.floor(zeroMonth/12),destMonth=zeroMonth%12;
 const last=new Date(Date.UTC(destYear,destMonth+1,0)).getUTCDate();
 return new Date(Date.UTC(destYear,destMonth,Math.min(d,last))).toISOString().slice(0,10);
};
function assessAftercare({job,execution,assets=[],asOf,maintenancePolicy=[]}={}){
 const issues=[],work=[];
 const jobId=value(job?.job_id);
 if(!jobId||value(execution?.['Job ID'])!==jobId)
   issues.push('CANONICAL_JOB_EXECUTION_LINK_UNVERIFIED');
 if(!['COMPLETED','JOB_COMPLETED','HANDOVER_COMPLETE','CLOSED'].includes(upper(job?.job_status)) &&
   !['COMPLETED','HANDOVER_COMPLETE','CLOSED'].includes(upper(execution?.['Completion Status'])))
   issues.push('JOB_CLOSEOUT_NOT_VERIFIED');
 const current=dateOnly(asOf);
 if(!current)issues.push('AS_OF_DATE_INVALID');
 if(!value(job?.client_crm_id)||!value(job?.property_id))
   issues.push('CLIENT_PROPERTY_ID_MISSING');
 const assignedAssets=assets.filter(a=>value(a.job_id)===jobId);
 const installedIds=new Set(),candidates=[],due=[];
 for(const asset of assignedAssets){
   const id=value(asset.installed_part_id);
   if(!id||installedIds.has(id)){issues.push('DUPLICATE_OR_MISSING_INSTALLED_PART_ID');continue;}
   installedIds.add(id);
   if(value(asset.client_id)!==value(job?.client_crm_id) ||
      value(asset.property_id)!==value(job?.property_id)){
     issues.push('ASSET_CLIENT_PROPERTY_MISMATCH:'+id);continue;
   }
   const installed=dateOnly(asset.installation_date);
   if(!installed || !value(asset.part_id)|| !value(asset.photo_evidence)){
     issues.push('INSTALLED_PART_EVIDENCE_INCOMPLETE:'+id);continue;
   }
   const warrantyEnd=dateOnly(asset.warranty_end);
   const warrantyStart=dateOnly(asset.warranty_start);
   if(value(asset.warranty_end) && !warrantyEnd)issues.push('WARRANTY_END_DATE_INVALID:'+id);
   if(warrantyStart && warrantyEnd && warrantyStart>warrantyEnd)
     issues.push('WARRANTY_DATE_CONTRADICTION:'+id);
   const status=upper(asset.warranty_status);
   candidates.push({
     installed_part_id:id,part_id:value(asset.part_id),
     warranty_start:warrantyStart,warranty_end:warrantyEnd,
     warranty_status:status||'UNKNOWN',
     policy_scope:'MYRIAD_GREEN_REPLACED_PARTS_ONLY',
     warranty_active_as_of:!!(current&&warrantyStart&&warrantyEnd &&
       warrantyStart<=current && current<=warrantyEnd &&
       !['VOID','EXPIRED','CANCELLED','TAMPERED'].includes(status))
   });
   const matchingRules=maintenancePolicy.filter(rule=>value(rule.part_id)===value(asset.part_id));
   if(matchingRules.length>1){issues.push('DUPLICATE_MAINTENANCE_POLICY:'+asset.part_id);continue;}
   const rule=matchingRules[0];
   if(rule){
     const months=Number(rule.interval_months);
     if(!Number.isInteger(months)||months<1||months>120||
       upper(rule.approval_state)!=='APPROVED'||!value(rule.policy_id)){
       issues.push('MAINTENANCE_POLICY_NOT_VERIFIED:'+asset.part_id);continue;
     }
     let next=addMonths(installed,months);
     if(current){
       // Bounded loop; no synthetic write or client outreach.
       for(let i=0;i<120 && next<current;i++)next=addMonths(next,months);
     }
     due.push({
       candidate_id:'SERVICE_DUE|'+id+'|'+rule.policy_id+'|'+next,
       installed_part_id:id,part_id:value(asset.part_id),
       policy_id:value(rule.policy_id),due_date:next,
       status:'DRAFT_REVIEW_ONLY'
     });
   }
 }
 if(!assignedAssets.length)issues.push('NO_INSTALLED_PARTS_IN_CANONICAL_REGISTER');
 return {
   schema_version:'MAGOS_AFTERCARE_READINESS_V1',
   job_id:jobId,
   state:issues.length?'REVIEW_REQUIRED':'AFTERCARE_CANDIDATES_PREPARED',
   issues:[...new Set(issues)],
   asset_count:candidates.length,
   warranties:candidates,
   service_due_candidates:due,
   review_status:upper(execution?.['Review Status']||job?.review_status)||'UNKNOWN',
   client_contact_consent_verified:false,
   review_request_authorized:false,
   warranty_liability_decided:false,
   service_message_authorized:false,
   writes:[],side_effects:false
 };
}
async function inspectJobAftercare({stores,jobId,asOf,maintenancePolicy=[]}={}){
 if(!value(jobId)||!stores?.crm?.readObjects||!stores?.commercial?.readObjects||
    !stores?.supplier?.readObjects){
   return {state:'REVIEW_REQUIRED',issues:['CANONICAL_AFTERCARE_READERS_MISSING'],
     writes:[],side_effects:false};
 }
 const [jobs,executions,assets]=await Promise.all([
   stores.crm.readObjects('Jobs_Opportunities',{maxRows:null}),
   stores.commercial.readObjects('Job Execution',{maxRows:null}),
   stores.supplier.readObjects('Installed_Parts',{maxRows:null})
 ]);
 if(![jobs,executions,assets].every(Array.isArray))throw Error('CANONICAL_AFTERCARE_SOURCE_UNAVAILABLE');
 const jj=jobs.filter(j=>value(j.job_id)===jobId);
 const ee=executions.filter(e=>value(e['Job ID'])===jobId);
 if(jj.length!==1||ee.length!==1){
   return {state:'REVIEW_REQUIRED',issues:['JOB_EXECUTION_ID_NOT_UNIQUE_OR_MISSING'],
    writes:[],side_effects:false};
 }
 return assessAftercare({job:jj[0],execution:ee[0],assets,asOf,maintenancePolicy});
}
module.exports={assessAftercare,inspectJobAftercare,dateOnly,addMonths};
