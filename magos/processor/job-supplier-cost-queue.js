'use strict';
const {inspectSupplierAllocation}=require('./supplier-cost-evidence');
const val=x=>String(x??'').trim();

async function inspectJobSupplierCostQueue({stores,jobId}={}){
 const fail=reason=>({schema_version:'MAGOS_JOB_SUPPLIER_COST_QUEUE_V1',
  state:'REVIEW_REQUIRED',job_id:val(jobId),blockers:[reason],
  items:[],counts:{total:0,ready:0,review:0},writes:[],side_effects:false});
 if(!stores?.crm?.findByKey||!stores?.supplier?.readObjects||
    !stores.supplier.findByKey||!val(jobId))return fail('CANONICAL_JOB_OR_SOURCE_READERS_MISSING');
 let found,allocations;
 try{
  [found,allocations]=await Promise.all([
   stores.crm.findByKey('Jobs_Opportunities','job_id',jobId),
   stores.supplier.readObjects('Cost_Allocations',{maxRows:null})
  ]);
 }catch{return fail('CANONICAL_SUPPLIER_QUEUE_SOURCE_UNAVAILABLE');}
 const job=found?.object,opportunityId=val(job?.opportunity_id);
 if(!job||val(job.job_id)!==jobId||!opportunityId||!Array.isArray(allocations))
  return fail('CANONICAL_JOB_OR_ALLOCATION_INDEX_UNVERIFIED');
 const relevant=allocations.filter(a=>val(a.job_id)===jobId ||
   (val(a.opportunity_id)===opportunityId && !val(a.job_id)));
 if(relevant.length>200)return fail('SUPPLIER_ALLOCATION_QUEUE_TOO_LARGE_TO_VERIFY');
 const source={...stores,supplier:{
   ...stores.supplier,
   readObjects:async name=>name==='Cost_Allocations'?
     allocations:stores.supplier.readObjects(name,{maxRows:null}),
   findByKey:(...args)=>stores.supplier.findByKey(...args)
 }};
 const items=[];
 for(const a of relevant){
  const key=val(a.allocation_id);
  if(!key){items.push({allocation_id:'',state:'REVIEW_REQUIRED',
    blockers:['ALLOCATION_ID_MISSING']});continue;}
  const r=await inspectSupplierAllocation({
   stores:source,jobId,opportunityId,sourceEventId:key
  });
  items.push({allocation_id:key,state:r.verified?'SOURCE_VERIFIED':'REVIEW_REQUIRED',
   blockers:r.blockers||[],reconciliation_status:val(a.reconciliation_status)});
 }
 items.sort((a,b)=>a.allocation_id.localeCompare(b.allocation_id));
 const ready=items.filter(a=>a.state==='SOURCE_VERIFIED').length;
 return {schema_version:'MAGOS_JOB_SUPPLIER_COST_QUEUE_V1',
  job_id:jobId,opportunity_id:opportunityId,
  state:items.some(x=>x.state==='REVIEW_REQUIRED')?'REVIEW_REQUIRED':'SOURCE_INSPECTION_COMPLETE',
  counts:{total:items.length,ready,review:items.length-ready},
  items,stock_or_invoice_auto_approval:false,
  writes:[],side_effects:false};
}
module.exports={inspectJobSupplierCostQueue};
