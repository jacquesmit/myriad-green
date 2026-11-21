'use strict';
const crypto=require('node:crypto');
const {createIfAbsent,composeTransactionPlan}=require('../writer/operations');
const val=x=>String(x??'').trim();
const categories=new Set(['MATERIALS','LABOUR','TRAVEL','TOOL_HIRE','SUBCONTRACTOR','DISPOSAL','OTHER_DIRECT']);
function positiveCents(value){
  const text=val(value);
  if(!/^\d+(\.\d{1,2})?$/.test(text))return null;
  const [whole,decimal='']=text.split('.');
  const cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
  return Number.isSafeInteger(cents)&&cents>0&&cents<=1000000000?cents:null;
}
function provisionalId(jobId,eventId){
 return 'DP-'+crypto.createHash('sha256').update(jobId+'|'+eventId).digest('hex').slice(0,22).toUpperCase();
}
async function captureProvisionalJobCost({
 writer,jobId,sourceEventId,category,description,amountZar,ownerAttestation,
 now=()=>new Date(),dryRun=false
}={}){
 const review=(reason_code)=>({state:'REVIEW_REQUIRED',reason_code,writes:[],side_effects:false});
 const jobKey=val(jobId),eventKey=val(sourceEventId),desc=val(description),costCategory=val(category);
 const cents=positiveCents(amountZar);
 if(!/^JOB-[A-Za-z0-9_-]{3,96}$/.test(jobKey)||!eventKey||
   eventKey.length>192||!categories.has(costCategory)||!desc||
   desc.length>320||cents===null)return review('PROVISIONAL_COST_INPUT_INVALID');
 if(!writer?.stores?.crm?.findByKey||!writer.stores.commercial?.findByKey||
    typeof writer.execute!=='function')return review('CANONICAL_P3_WRITER_REQUIRED');
 let job,exec;
 try{
  [job,exec]=await Promise.all([
   writer.stores.crm.findByKey('Jobs_Opportunities','job_id',jobKey),
   writer.stores.commercial.findByKey('Job Execution','Job ID',jobKey)
  ]);
 }catch{return review('JOB_LOOKUP_FAILED');}
 const client=job?.object,execution=exec?.object;
 const opportunityId=val(client?.opportunity_id);
 if(!client||!execution||!opportunityId||val(execution.opportunity_id)!==opportunityId)
  return review('JOB_EXECUTION_LINK_NOT_VERIFIED');
 if(typeof ownerAttestation!=='function')return review('OWNER_AUTHORITY_NOT_CONFIGURED');
 const owner=await ownerAttestation({job_id:jobKey,source_event_id:eventKey});
 if(owner?.verified!==true||owner.job_id!==jobKey||
   owner.source_event_id!==eventKey||!val(owner.authorized_owner_id))
  return review(owner?.reason_code||'OWNER_DECLARATION_NOT_VERIFIED');
 const date=now();if(!Number.isFinite(date?.getTime?.()))return review('CLOCK_NOT_AVAILABLE');
 const amount=(cents/100).toFixed(2),costId=provisionalId(jobKey,eventKey);
 const record={
  direct_cost_id:costId,opportunity_id:opportunityId,job_id:jobKey,
  client:val(client.client_name||execution.Client||''),cost_category:costCategory,
  description:desc,basis:'OWNER_REPORTED_ACTUAL_PENDING_RECEIPT',
  quantity:'1',unit_rate:amount,amount,
  financial_treatment:'PROVISIONAL_DIRECT_COST',
  evidence_status:'OWNER_CONFIRMED_EVIDENCE_PENDING',evidence_link:'',
  allocation_status:'TO_CONFIRM',source_authority:'OWNER_DECLARATION',
  entered_at:date.toISOString(),
  notes:'Provisional declaration '+eventKey+' by '+owner.authorized_owner_id+'; not confirmed supplier expense or job profit.'
 };
 const plan=composeTransactionPlan({
  idempotency_key:'MAGOS_PROVISIONAL_COST_V1|'+jobKey+'|'+eventKey,
  event_type:'OWNER_PROVISIONAL_DIRECT_COST_DECLARED',
  source_event_id:eventKey,
  preconditions:[
   {store:'crm',sheet:'Jobs_Opportunities',
    key:{header:'job_id',value:jobKey},expect:{opportunity_id:opportunityId}},
   {store:'commercial',sheet:'Job Execution',
    key:{header:'Job ID',value:jobKey},expect:{opportunity_id:opportunityId}}
  ],
  writes:[createIfAbsent({
   store:'commercial',workbook_role:'COMMERCIAL',sheet:'Project Direct Costs',
   authority:'AUTHORITATIVE',entity_type:'Direct Job Cost',
   key:{header:'direct_cost_id',value:costId},
   intent:'RECORD_PROVISIONAL_OWNER_REPORTED_COST',
   values:record,required_headers:Object.keys(record)
  })]
 });
 if(dryRun)return {state:'DRY_RUN',direct_cost_id:costId,plan,verified_cost:false,profit_final:false};
 let response;
 try{response=await writer.execute(plan);}
 catch{return review('P3_PROVISIONAL_COST_WRITE_FAILED');}
 if(!['COMMITTED','DUPLICATE_NO_OP'].includes(response?.state))
  return {state:response?.state||'REVIEW_REQUIRED',transaction:response};
 let readback;
 try{readback=await writer.stores.commercial.findByKey('Project Direct Costs','direct_cost_id',costId);}
 catch{return {state:'COMMIT_READBACK_UNVERIFIED',direct_cost_id:costId};}
 if(!readback||val(readback.object?.direct_cost_id)!==costId||
   val(readback.object?.job_id)!==jobKey||
   val(readback.object?.financial_treatment)!=='PROVISIONAL_DIRECT_COST'||
   Number(readback.object?.amount)!==cents/100)
   return {state:'COMMIT_READBACK_UNVERIFIED',direct_cost_id:costId};
 return {state:response.state,direct_cost_id:costId,amount_zar:cents/100,
  verified_cost:false,final_profit_authorized:false,readback_verified:true};
}
module.exports={captureProvisionalJobCost,provisionalId,positiveCents};
