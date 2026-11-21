'use strict';

const {patchIfMatch,composeTransactionPlan}=require('../writer/operations');
const {deterministicCostId}=require('./record-direct-job-cost');
const val=x=>String(x??'').trim();
const approvedCategories=new Set(['MATERIALS','SUPPLIER_INVOICE','LABOUR','TRAVEL','TOOL_HIRE','SUBCONTRACTOR','DISPOSAL','OTHER_DIRECT']);
const evidenced=new Set(['BANK_EVIDENCED','SUPPLIER_INVOICE_EVIDENCED','VERIFIED']);

function amountInCents(value){
 const text=val(value);
 if(!/^\d+(\.\d{1,2})?$/.test(text))return null;
 const [whole,fraction='']=text.split('.');
 const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(result)&&result>0?result:null;
}

/**
 * Upgrades ONE EXISTING provisional record after independent source review.
 * It never appends a second expense, changes the recorded amount or finalizes
 * profitability. The trusted attestation binds BOTH the provisional row and
 * the receipt source event.
 */
async function verifyProvisionalCost({
 writer,jobId,provisionalCostId,sourceEventId,evidenceVerifier,dryRun=false
}={}){
 const reject=reason_code=>({state:'REVIEW_REQUIRED',reason_code,
  job_id:val(jobId),provisional_cost_id:val(provisionalCostId),
  writes:[],side_effects:false});
 if(!writer?.stores?.crm?.findByKey||!writer.stores.commercial?.findByKey||
    typeof writer.execute!=='function')return reject('CANONICAL_WRITER_MISSING');
 const id=val(provisionalCostId),jobKey=val(jobId),receiptEvent=val(sourceEventId);
 if(!/^DP-[A-F0-9]{22}$/.test(id)||
    !/^JOB-[A-Za-z0-9_-]{3,96}$/.test(jobKey)||
    !receiptEvent||receiptEvent.length>192)
   return reject('CANONICAL_COST_JOB_OR_RECEIPT_ID_INVALID');
 let jobFound,executionFound,costFound,independentExisting;
 try {
   [jobFound,executionFound,costFound,independentExisting]=await Promise.all([
    writer.stores.crm.findByKey('Jobs_Opportunities','job_id',jobKey),
    writer.stores.commercial.findByKey('Job Execution','Job ID',jobKey),
    writer.stores.commercial.findByKey('Project Direct Costs','direct_cost_id',id),
    writer.stores.commercial.findByKey('Project Direct Costs','direct_cost_id',
       deterministicCostId(jobKey,receiptEvent))
   ]);
 }catch{return reject('CANONICAL_COST_SOURCE_UNAVAILABLE');}
 if(independentExisting)return reject('RECEIPT_ALREADY_RECORDED_AS_SEPARATE_COST');
 const job=jobFound?.object,exec=executionFound?.object,cost=costFound?.object;
 const opp=val(job?.opportunity_id);
 if(!job||val(job.job_id)!==jobKey||!exec||
    val(exec['Job ID'])!==jobKey||!opp||val(exec.opportunity_id)!==opp)
   return reject('JOB_EXECUTION_IDENTITY_UNVERIFIED');
 if(!cost||val(cost.direct_cost_id)!==id||val(cost.job_id)!==jobKey||
    val(cost.opportunity_id)!==opp)return reject('PROVISIONAL_RECORD_IDENTITY_UNVERIFIED');
 if(val(cost.financial_treatment)!=='PROVISIONAL_DIRECT_COST'||
    val(cost.evidence_status)!=='OWNER_CONFIRMED_EVIDENCE_PENDING'||
    val(cost.allocation_status)!=='TO_CONFIRM'||val(cost.evidence_link))
   return reject('PROVISIONAL_RECORD_NOT_PENDING');
 const cents=amountInCents(cost.amount);
 if(cents===null||!approvedCategories.has(val(cost.cost_category)))
   return reject('PROVISIONAL_COST_VALUE_INVALID');
 if(typeof evidenceVerifier!=='function')return reject('INDEPENDENT_RECEIPT_VERIFIER_REQUIRED');
 let evidence;
 try {
  evidence=await evidenceVerifier({
   job_id:jobKey,opportunity_id:opp,source_event_id:receiptEvent,
   provisional_cost_id:id
  });
 }catch{return reject('INDEPENDENT_RECEIPT_UNAVAILABLE');}
 if(evidence?.verified!==true||
    evidence.job_id!==jobKey||evidence.opportunity_id!==opp||
    evidence.source_event_id!==receiptEvent||evidence.provisional_cost_id!==id||
    evidence.amount_cents!==cents||
    val(evidence.cost_category)!==val(cost.cost_category)||
    !evidenced.has(val(evidence.evidence_status))||
    evidence.allocation_status!=='ALLOCATED_TO_JOB'||
    evidence.stock_split_verified!==true||
    !val(evidence.independent_reviewer_id)||!val(evidence.source_authority)||
    !/^https:\/\/drive\.google\.com\//.test(val(evidence.evidence_link)))
   return reject(evidence?.reason_code||'RECEIPT_AMOUNT_CATEGORY_OR_ALLOCATION_UNVERIFIED');
 const changes={
   financial_treatment:'DIRECT_JOB_COST',
   evidence_status:evidence.evidence_status,
   evidence_link:evidence.evidence_link,
   allocation_status:'ALLOCATED_TO_JOB',
   source_authority:val(evidence.source_authority),
   notes:val(cost.notes)+' | Independent receipt '+receiptEvent+
      ' reviewed by '+evidence.independent_reviewer_id
 };
 const expected={
   opportunity_id:opp,job_id:jobKey,
   amount:cost.amount,cost_category:cost.cost_category,
   financial_treatment:'PROVISIONAL_DIRECT_COST',
   evidence_status:'OWNER_CONFIRMED_EVIDENCE_PENDING',
   allocation_status:'TO_CONFIRM',evidence_link:''
 };
 const plan=composeTransactionPlan({
   idempotency_key:'MAGOS_VERIFY_PROVISIONAL_COST_V1|'+id+'|'+receiptEvent,
   event_type:'PROVISIONAL_COST_VERIFIED_IN_PLACE',
   source_event_id:receiptEvent,evidence_link:evidence.evidence_link,
   preconditions:[
    {store:'crm',sheet:'Jobs_Opportunities',
      key:{header:'job_id',value:jobKey},expect:{opportunity_id:opp}},
    {store:'commercial',sheet:'Job Execution',
      key:{header:'Job ID',value:jobKey},expect:{opportunity_id:opp}}
   ],
   writes:[patchIfMatch({
    store:'commercial',workbook_role:'COMMERCIAL',
    sheet:'Project Direct Costs',authority:'AUTHORITATIVE',
    entity_type:'Direct Job Cost',
    intent:'VERIFY_PENDING_COST_WITH_INDEPENDENT_RECEIPT',
    key:{header:'direct_cost_id',value:id},expect:expected,changes,
    required_headers:[...Object.keys(expected),...Object.keys(changes)]
   })]
 });
 if(dryRun)return {state:'DRY_RUN',job_id:jobKey,provisional_cost_id:id,
   amount_zar:cents/100,plan,additional_cost_rows:0,profit_final:false};
 let result;
 try{result=await writer.execute(plan);}
 catch{return reject('P3_VERIFICATION_TRANSACTION_FAILED');}
 if(!['COMMITTED','DUPLICATE_NO_OP'].includes(result?.state))
   return {state:result?.state||'REVIEW_REQUIRED',reason_code:'P3_WRITE_NOT_CONFIRMED',
     provisional_cost_id:id,transaction:result};
 let readback;
 try{readback=await writer.stores.commercial.findByKey('Project Direct Costs','direct_cost_id',id);}
 catch{return {state:'COMMIT_READBACK_UNVERIFIED',provisional_cost_id:id};}
 const row=readback?.object;
 if(val(row?.direct_cost_id)!==id||val(row?.job_id)!==jobKey||
    val(row?.financial_treatment)!=='DIRECT_JOB_COST'||
    val(row?.evidence_link)!==evidence.evidence_link||
    val(row?.allocation_status)!=='ALLOCATED_TO_JOB'||
    amountInCents(row?.amount)!==cents)
   return {state:'COMMIT_READBACK_UNVERIFIED',provisional_cost_id:id};
 return {state:result.state,job_id:jobKey,provisional_cost_id:id,
   verified_amount_zar:cents/100,readback_verified:true,
   additional_cost_rows:0,profit_final:false,inventory_adjusted:false,
   payment_authorized:false};
}
module.exports={verifyProvisionalCost,amountInCents};
