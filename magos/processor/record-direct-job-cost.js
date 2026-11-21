'use strict';

const crypto=require('node:crypto');
const {createIfAbsent,composeTransactionPlan}=require('../writer/operations');
const val=x=>String(x??'').trim();
const approvedCategories=new Set([
 'MATERIALS','SUPPLIER_INVOICE','LABOUR','TRAVEL','TOOL_HIRE','SUBCONTRACTOR','DISPOSAL','OTHER_DIRECT'
]);
const asMoneyCents=x=>{
 const n=Number(x);
 return Number.isInteger(n)&&n>0&&n<=10000000000?n:null;
};
function deterministicCostId(jobId,sourceEventId){
 return 'DC-'+crypto.createHash('sha256').update(jobId+'|'+sourceEventId).digest('hex').slice(0,22).toUpperCase();
}
/**
 * Captures a real job direct-cost line only after server-side receipt/ledger
 * attestation. Writer authority and header ownership must already exist.
 * No credit to stock or financial margin update is implied by one new cost.
 */
async function recordVerifiedDirectCost({
 writer,jobId,sourceEventId,evidenceVerifier,dryRun=false,now=()=>new Date()
}={}){
 const review=reason_code=>({state:'REVIEW_REQUIRED',reason_code,
  job_id:val(jobId),writes:[],side_effects:false});
 if(!writer?.stores?.crm?.findByKey||!writer.stores.commercial?.findByKey||
   typeof writer.execute!=='function')return review('CANONICAL_WRITER_READERS_REQUIRED');
 const jobKey=val(jobId),eventKey=val(sourceEventId);
 if(!/^JOB-[A-Za-z0-9_-]{3,96}$/.test(jobKey)||!eventKey||eventKey.length>192)
  return review('CANONICAL_JOB_OR_SOURCE_EVENT_REQUIRED');
 let crm,execution;
 try{
  [crm,execution]=await Promise.all([
   writer.stores.crm.findByKey('Jobs_Opportunities','job_id',jobKey),
   writer.stores.commercial.findByKey('Job Execution','Job ID',jobKey)
  ]);
 }catch{return review('CANONICAL_JOB_LOOKUP_FAILED');}
 const job=crm?.object,work=execution?.object;
 if(!job||!work||val(job.job_id)!==jobKey||val(work['Job ID'])!==jobKey||
   !val(job.opportunity_id)||val(job.opportunity_id)!==val(work.opportunity_id))
  return review('JOB_OR_EXECUTION_LINK_NOT_VERIFIED');
 if(typeof evidenceVerifier!=='function')return review('DIRECT_COST_EVIDENCE_VERIFIER_REQUIRED');
 let att;
 try{att=await evidenceVerifier({job_id:jobKey,opportunity_id:val(job.opportunity_id),
    source_event_id:eventKey});}
 catch{return review('INDEPENDENT_DIRECT_COST_SOURCE_UNAVAILABLE');}
 if(att?.verified!==true||att.job_id!==jobKey||
   att.opportunity_id!==val(job.opportunity_id)||
   att.source_event_id!==eventKey||
   !approvedCategories.has(val(att.cost_category))||
   !val(att.description)||val(att.description).length>320||
   !asMoneyCents(att.amount_cents)||
   !val(att.evidence_link)||!/^https:\/\/drive\.google\.com\//.test(att.evidence_link)||
   !val(att.source_authority)||!val(att.independent_reviewer_id))
   return review(att?.reason_code||'DIRECT_COST_ATTESTATION_INCOMPLETE');
 if(!['BANK_EVIDENCED','SUPPLIER_INVOICE_EVIDENCED','VERIFIED'].includes(val(att.evidence_status)))
   return review('DIRECT_COST_RECEIPT_NOT_INDEPENDENTLY_EVIDENCED');
 if(att.allocation_status!=='ALLOCATED_TO_JOB'||
   att.stock_split_verified!==true)
   return review('JOB_ALLOCATION_OR_STOCK_SPLIT_NOT_VERIFIED');
 // If source evidence links to an existing provisional row, the ONLY valid
 // path is an in-place P3 verification. Never append a second expense.
 if(val(att.provisional_cost_id))
   return review('USE_IN_PLACE_PROVISIONAL_COST_VERIFICATION');
 let pending;
 try {
   const {provisionalId}=require('./provisional-job-cost');
   pending=await writer.stores.commercial.findByKey(
     'Project Direct Costs','direct_cost_id',provisionalId(jobKey,eventKey));
 }catch{return review('PENDING_COST_DUPLICATE_CHECK_UNAVAILABLE');}
 if(pending)return review('PROVISIONAL_COST_ALREADY_EXISTS_FOR_SOURCE_EVENT');
 const costId=deterministicCostId(jobKey,eventKey);
 const date=now();
 if(!(date instanceof Date)||!Number.isFinite(date.getTime()))
   return review('CAPTURE_TIME_UNAVAILABLE');
 const amount=(att.amount_cents/100).toFixed(2);
 const values={
   direct_cost_id:costId,
   opportunity_id:val(job.opportunity_id),
   job_id:jobKey,
   client:val(job.client_name||work.Client||''),
   cost_category:att.cost_category,
   description:att.description,
   basis:val(att.basis)||'INDEPENDENT_SOURCE_RECEIPT',
   quantity:'1',
   unit_rate:amount,
   amount,
   financial_treatment:'DIRECT_JOB_COST',
   evidence_status:att.evidence_status,
   evidence_link:att.evidence_link,
   allocation_status:'ALLOCATED_TO_JOB',
   source_authority:att.source_authority,
   entered_at:date.toISOString(),
   notes:'Verified receipt event '+eventKey+'; reviewed by '+att.independent_reviewer_id
 };
 const plan=composeTransactionPlan({
   idempotency_key:'MAGOS_DIRECT_COST_V1|'+jobKey+'|'+eventKey,
   event_type:'VERIFIED_DIRECT_JOB_COST_CAPTURED',
   source_event_id:eventKey,
   evidence_link:att.evidence_link,
   preconditions:[
     {store:'crm',sheet:'Jobs_Opportunities',
      key:{header:'job_id',value:jobKey},
      expect:{opportunity_id:val(job.opportunity_id)}},
     {store:'commercial',sheet:'Job Execution',
      key:{header:'Job ID',value:jobKey},
      expect:{opportunity_id:val(job.opportunity_id)}}
   ],
   writes:[createIfAbsent({
     store:'commercial',workbook_role:'COMMERCIAL',
     sheet:'Project Direct Costs',
     authority:'AUTHORITATIVE',entity_type:'Direct Job Cost',
     key:{header:'direct_cost_id',value:costId},
     intent:'CAPTURE_RECEIPT_VERIFIED_ACTUAL_JOB_COST',
     values,required_headers:Object.keys(values)
   })]
 });
 if(dryRun)return {state:'DRY_RUN',job_id:jobKey,direct_cost_id:costId,plan,
   margin_final:false,inventory_adjusted:false,payment_authorized:false};
 let result;
 try{result=await writer.execute(plan);}
 catch{return review('DIRECT_COST_P3_WRITE_OR_GOVERNANCE_FAILED');}
 if(!['COMMITTED','DUPLICATE_NO_OP'].includes(result?.state))
   return {state:result?.state||'REVIEW_REQUIRED',job_id:jobKey,transaction:result};
 let readback;
 try{readback=await writer.stores.commercial.findByKey('Project Direct Costs','direct_cost_id',costId);}
 catch{return {state:'COMMIT_READBACK_UNVERIFIED',job_id:jobKey,direct_cost_id:costId};}
 if(!readback||val(readback.object?.job_id)!==jobKey||
   val(readback.object?.evidence_link)!==att.evidence_link||
   Number(readback.object?.amount)!==Number(amount))
   return {state:'COMMIT_READBACK_UNVERIFIED',job_id:jobKey,direct_cost_id:costId};
 return {state:result.state,job_id:jobKey,direct_cost_id:costId,
   recorded_amount_zar:Number(amount),readback_verified:true,
   margin_final:false,inventory_adjusted:false,payment_authorized:false};
}
module.exports={recordVerifiedDirectCost,deterministicCostId};
