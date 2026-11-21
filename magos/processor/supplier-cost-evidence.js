'use strict';

/**
 * Supplier Cost_Allocations is the existing allocation source of truth.
 * A status label is NOT a bank payment, receipt, physical-stock check or
 * independent reviewer attestation. This gate inspects the whole receipt
 * lineage and only grants verification with separately trusted corroboration.
 */
const val=x=>String(x??'').trim();
const positive=x=>{
 const t=val(x).replace(/^R\s*/i,'').replace(/,/g,'').replace(/\s/g,'');
 if(!/^\d+(\.\d{1,2})?$/.test(t))return null;
 const [a,b='']=t.split('.');
 const n=Number(a)*100+Number(b.padEnd(2,'0'));
 return Number.isSafeInteger(n)&&n>0?n:null;
};
function validDriveUrl(s){
 try {
  const u=new URL(val(s));
  return u.protocol==='https:'&&
   ['drive.google.com','docs.google.com'].includes(u.hostname)&&
   !u.username&&!u.password&&!u.port&&
   /^\/(file\/d\/|open|document\/d\/|spreadsheets\/d\/)/.test(u.pathname);
 }catch{return false;}
}
async function inspectSupplierAllocation({
 stores,jobId,opportunityId,sourceEventId,provisionalCostId,
 reviewAuthority,stockAuthority
}={}){
 const blockers=[];
 const block=(reason)=>{blockers.push(reason);};
 const key=val(sourceEventId),job=val(jobId),opp=val(opportunityId);
 if(!stores?.supplier?.readObjects||!stores.supplier.findByKey||
   !key||!job||!opp) {
  return {verified:false,reason_code:'SUPPLIER_ALLOCATION_READERS_OR_IDS_MISSING',
   blockers:['SUPPLIER_ALLOCATION_READERS_OR_IDS_MISSING'],writes:[],side_effects:false};
 }
 let allocations;
 try {allocations=await stores.supplier.readObjects('Cost_Allocations',{maxRows:null});}
 catch{block('CANONICAL_COST_ALLOCATIONS_UNAVAILABLE');}
 if(!Array.isArray(allocations)) {
  return {verified:false,reason_code:'CANONICAL_COST_ALLOCATIONS_UNAVAILABLE',
   blockers:['CANONICAL_COST_ALLOCATIONS_UNAVAILABLE'],writes:[],side_effects:false};
 }
 const matches=allocations.filter(r=>val(r.allocation_id)===key);
 if(matches.length!==1)block('ALLOCATION_ID_MISSING_OR_DUPLICATED');
 const a=matches.length===1?matches[0]:null;
 if(!a)return {verified:false,reason_code:blockers[0],blockers,writes:[],side_effects:false};
 if(val(a.allocation_type)!=='JOB')block('ALLOCATION_NOT_FOR_JOB');
 if(val(a.job_id)!==job||val(a.opportunity_id)!==opp)block('ALLOCATION_JOB_OPPORTUNITY_MISMATCH');
 if(val(a.verification_status)!=='VERIFIED')block('ALLOCATION_NOT_VERIFIED');
 if(val(a.reconciliation_status)!=='FULLY_RECONCILED')
   block('ALLOCATION_NOT_FULLY_RECONCILED');
 if(val(a.currency)!=='ZAR')block('ALLOCATION_CURRENCY_NOT_ZAR');
 const cents=positive(a.allocated_value_incl_vat);
 if(cents===null)block('ALLOCATION_AMOUNT_NOT_VERIFIED');
 if(!val(a.source_line_id)||!val(a.supplier_document_id)||!val(a.part_id)||
    !val(a.evidence_drive_file_id))block('SOURCE_DOCUMENT_LINE_OR_PART_ID_MISSING');
 if(!validDriveUrl(a.evidence_link))block('SOURCE_DOCUMENT_DRIVE_LINK_NOT_VALID');
 if(val(a.reversal_of_allocation_id)||val(a.supersedes_allocation_id))
   block('ALLOCATION_REVERSAL_OR_SUPERSESSION_NEEDS_RECONCILIATION');
 if(allocations.some(r=>r!==a&&(val(r.reversal_of_allocation_id)===key||
   val(r.supersedes_allocation_id)===key)))
   block('ALLOCATION_HAS_DOWNSTREAM_REVERSAL_OR_SUPERSESSION');
 if(!val(a.allocation_basis)||!val(a.provenance))block('ALLOCATION_PROVENANCE_MISSING');
 let line;
 if(val(a.source_line_id)){
  try {
   const found=await stores.supplier.findByKey('Supplier_Source_Lines','source_line_id',val(a.source_line_id));
   line=found?.object;
  }catch{block('SUPPLIER_SOURCE_LINE_UNAVAILABLE');}
  if(!line)block('SUPPLIER_SOURCE_LINE_MISSING');
  else{
   if(val(line.source_line_id)!==val(a.source_line_id)||
      val(line.evidence_link)!==val(a.evidence_link))
     block('ALLOCATION_SOURCE_LINE_EVIDENCE_MISMATCH');
   if(val(line.supplier_quote_id)&&
      val(line.supplier_quote_id)!==val(a.supplier_document_id))
     block('SUPPLIER_DOCUMENT_REFERENCE_MISMATCH');
   if(val(line.canonical_part_id)&&
      val(line.canonical_part_id)!==val(a.part_id))
     block('ALLOCATION_PART_ID_CONFLICT');
  }
 }
 let reviewer=null,stock=null;
 if(typeof reviewAuthority!=='function')block('INDEPENDENT_REVIEW_AUTHORITY_UNAVAILABLE');
 else{
  try{reviewer=await reviewAuthority({allocation:a,sourceLine:line,job_id:job,opportunity_id:opp});}
  catch{block('INDEPENDENT_REVIEW_UNAVAILABLE');}
  if(reviewer?.verified!==true||reviewer?.allocation_id!==key||
     !val(reviewer?.reviewer_id)||reviewer?.source_document_checked!==true||
     reviewer?.receipt_type!=='SUPPLIER_INVOICE'||
     reviewer?.document_id!==val(a.supplier_document_id)||
     reviewer?.reviewed_amount_cents!==cents)
    block('INDEPENDENT_SOURCE_DOCUMENT_REVIEW_MISSING');
 }
 if(typeof stockAuthority!=='function')block('STOCK_SPLIT_AUTHORITY_UNAVAILABLE');
 else {
  try{stock=await stockAuthority({allocation:a,sourceLine:line,job_id:job,opportunity_id:opp});}
  catch{block('STOCK_SPLIT_RECONCILIATION_UNAVAILABLE');}
  if(stock?.verified!==true||stock?.allocation_id!==key||
     stock?.job_id!==job||stock?.stock_split_verified!==true||
     stock?.part_id!==val(a.part_id)||
     Number(stock?.allocated_quantity)!==Number(a.allocated_qty))
    block('STOCK_SPLIT_NOT_INDEPENDENTLY_VERIFIED');
 }
 if(blockers.length)return {verified:false,reason_code:blockers[0],
   blockers:[...new Set(blockers)],allocation_id:key,
   writes:[],side_effects:false};
 return {
  verified:true,job_id:job,opportunity_id:opp,source_event_id:key,
  ...(val(provisionalCostId)?{provisional_cost_id:val(provisionalCostId)}:{}),
  cost_category:'MATERIALS',description:val(line?.source_description||a.part_id),
  amount_cents:cents,evidence_status:'SUPPLIER_INVOICE_EVIDENCED',
  allocation_status:'ALLOCATED_TO_JOB',stock_split_verified:true,
  evidence_link:val(a.evidence_link),source_authority:'SUPPLIER_COST_ALLOCATION_AND_RECEIPT',
  independent_reviewer_id:val(reviewer.reviewer_id),
  source_allocation_id:key,writes:[],side_effects:false
 };
}
function makeSupplierCostEvidenceVerifier({stores,reviewAuthority,stockAuthority}={}){
 return async ({job_id,opportunity_id,source_event_id,provisional_cost_id}={})=>
   inspectSupplierAllocation({stores,jobId:job_id,opportunityId:opportunity_id,
    sourceEventId:source_event_id,provisionalCostId:provisional_cost_id,
    reviewAuthority,stockAuthority});
}
module.exports={inspectSupplierAllocation,makeSupplierCostEvidenceVerifier,validDriveUrl,positive};
